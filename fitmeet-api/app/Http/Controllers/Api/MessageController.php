<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Jobs\SendPushNotification;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    // GET /messages/unread-count
    public function unreadCount(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $count = Message::query()
            ->join('conversation_participants as cp', function ($join) use ($me) {
                $join->on('cp.conversation_id', '=', 'messages.conversation_id')
                    ->where('cp.user_id', '=', $me);
            })
            ->where('messages.sender_id', '!=', $me)
            ->where(function ($query) {
                $query->whereNull('cp.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'cp.last_read_at');
            })
            ->count();

        return response()->json(['count' => $count]);
    }

    // GET /messages — list conversations
    public function index(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $conversations = Conversation::query()
            ->whereHas('participants', fn ($query) => $query->where('users.id', $me))
            ->with([
                'participants:id,name,avatar',
                'latestMessage.sender:id,name,avatar',
            ])
            ->withCount([
                'messages as unread_count' => function ($query) use ($me) {
                    $query->where('sender_id', '!=', $me)
                        ->whereRaw(
                            "messages.created_at > COALESCE((SELECT cp.last_read_at FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = ?), '1970-01-01 00:00:00')",
                            [$me]
                        );
                },
            ])
            ->get()
            ->filter(fn (Conversation $conversation) => $conversation->latestMessage)
            ->sortByDesc(fn (Conversation $conversation) => $conversation->latestMessage?->created_at?->getTimestamp() ?? 0)
            ->values();

        $data = $conversations->map(fn (Conversation $conversation) => $this->serializeConversationListItem($conversation, $me));

        return response()->json(['data' => $data]);
    }

    // GET /messages/conversations/{conversation} — full thread, marks messages as read
    public function conversationThread(Request $request, Conversation $conversation): JsonResponse
    {
        $me = $request->user()->id;
        $this->authorizeParticipant($conversation, $me);

        $conversation->participants()->updateExistingPivot($me, ['last_read_at' => now()]);

        $messages = $conversation->messages()
            ->with('sender:id,name,avatar')
            ->orderBy('created_at')
            ->get()
            ->map(fn (Message $message) => [
                'id'         => $message->id,
                'body'       => $message->body,
                'is_mine'    => $message->sender_id === $me,
                'created_at' => $message->created_at->toIso8601String(),
                'sender'     => [
                    'id'     => $message->sender->id,
                    'name'   => $message->sender->name,
                    'avatar' => $message->sender->avatar,
                ],
            ]);

        $conversation->load('participants:id,name,avatar');

        return response()->json([
            'conversation' => $this->serializeConversationDetail($conversation, $me),
            'data'         => $messages,
        ]);
    }

    // POST /messages/conversations — create a direct or group conversation and send first message
    public function createConversation(Request $request): JsonResponse
    {
        $request->validate([
            'participant_ids'   => 'required|array|min:1',
            'participant_ids.*' => 'integer|exists:users,id|distinct',
            'title'             => 'nullable|string|max:120',
            'body'              => 'required|string|max:2000',
        ]);

        $me = $request->user();
        $participantIds = collect($request->participant_ids)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id !== $me->id)
            ->unique()
            ->values();

        if ($participantIds->isEmpty()) {
            return response()->json(['message' => 'Select at least one recipient.'], 422);
        }

        $conversation = $participantIds->count() === 1
            ? $this->findOrCreateDirectConversation($me->id, $participantIds->first())
            : $this->createGroupConversation($me->id, $participantIds->all(), $request->string('title')->trim()->toString());

        $message = $this->createMessage($conversation, $me->id, $request->body);

        return response()->json([
            'conversation' => $this->serializeConversationDetail($conversation->fresh('participants:id,name,avatar'), $me->id),
            'data'         => $this->serializeMessage($message, $me->id),
        ], 201);
    }

    // POST /messages/conversations/{conversation} — send in existing conversation
    public function sendToConversation(Request $request, Conversation $conversation): JsonResponse
    {
        $request->validate(['body' => 'required|string|max:2000']);

        $me = $request->user()->id;
        $this->authorizeParticipant($conversation, $me);

        $message = $this->createMessage($conversation, $me, $request->body);

        return response()->json([
            'data' => $this->serializeMessage($message, $me),
        ], 201);
    }

    // POST /messages/conversations/{conversation}/participants
    public function addParticipants(Request $request, Conversation $conversation): JsonResponse
    {
        $request->validate([
            'participant_ids' => 'required|array|min:1',
            'participant_ids.*' => 'integer|exists:users,id|distinct',
        ]);

        $me = $request->user()->id;
        $this->authorizeParticipant($conversation, $me);
        $this->ensureGroupConversation($conversation);
        $this->authorizeManager($conversation, $me);

        $existingIds = $conversation->participants()->pluck('users.id')->map(fn ($id) => (int) $id);
        $newIds = collect($request->participant_ids)
            ->map(fn ($id) => (int) $id)
            ->reject(fn ($id) => $id === $me)
            ->diff($existingIds)
            ->values();

        if ($newIds->isNotEmpty()) {
            $now = now();
            $conversation->participants()->attach(
                $newIds->mapWithKeys(fn ($id) => [
                    $id => [
                        'last_read_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ])->all()
            );
        }

        $conversation->load('participants:id,name,avatar');

        return response()->json([
            'conversation' => $this->serializeConversationDetail($conversation, $me),
        ]);
    }

    // DELETE /messages/conversations/{conversation}/participants/{user}
    public function removeParticipant(Request $request, Conversation $conversation, User $user): JsonResponse
    {
        $me = $request->user()->id;
        $this->authorizeParticipant($conversation, $me);
        $this->ensureGroupConversation($conversation);

        $targetId = $user->id;
        $isSelfRemoval = $targetId === $me;

        if (! $isSelfRemoval) {
            $this->authorizeManager($conversation, $me);
        }

        if (! $conversation->participants()->where('users.id', $targetId)->exists()) {
            return response()->json(['message' => 'Participant not found.'], 404);
        }

        if ($conversation->created_by === $targetId && ! $isSelfRemoval) {
            return response()->json(['message' => 'Group owner cannot be removed.'], 422);
        }

        $conversation->participants()->detach($targetId);

        if (! $conversation->participants()->exists()) {
            $conversation->messages()->delete();
            $conversation->delete();

            return response()->json([
                'message' => $isSelfRemoval ? 'Conversation left.' : 'Participant removed.',
                'conversation' => null,
            ]);
        }

        $conversation->load('participants:id,name,avatar');

        return response()->json([
            'message' => $isSelfRemoval ? 'Conversation left.' : 'Participant removed.',
            'conversation' => $this->serializeConversationDetail($conversation, $me),
        ]);
    }

    // DELETE /messages/conversations/{conversation}
    public function destroyConversation(Request $request, Conversation $conversation): JsonResponse
    {
        $me = $request->user()->id;
        $this->authorizeParticipant($conversation, $me);

        if ($conversation->is_group) {
            $conversation->participants()->detach($me);

            if (! $conversation->participants()->exists()) {
                $conversation->messages()->delete();
                $conversation->delete();
            }

            return response()->json(['message' => 'Conversation left.']);
        }

        $conversation->messages()->delete();
        $conversation->delete();

        return response()->json(['message' => 'Conversation deleted.']);
    }

    // GET /messages/{user} — direct thread, marks messages as read
    public function thread(Request $request, User $user): JsonResponse
    {
        $conversation = $this->findOrCreateDirectConversation($request->user()->id, $user->id);

        return $this->conversationThread($request, $conversation);
    }

    // DELETE /messages/{user} — delete direct conversation
    public function destroy(Request $request, User $user): JsonResponse
    {
        $conversation = $this->findDirectConversation($request->user()->id, $user->id);

        if (! $conversation) {
            return response()->json(['message' => 'Conversation deleted.']);
        }

        return $this->destroyConversation($request, $conversation);
    }

    // POST /messages/{user} — send a direct message
    public function send(Request $request, User $user): JsonResponse
    {
        $request->validate(['body' => 'required|string|max:2000']);

        $conversation = $this->findOrCreateDirectConversation($request->user()->id, $user->id);
        $message = $this->createMessage($conversation, $request->user()->id, $request->body);

        return response()->json([
            'data' => $this->serializeMessage($message, $request->user()->id),
        ], 201);
    }

    private function createGroupConversation(int $creatorId, array $participantIds, string $title = ''): Conversation
    {
        $conversation = Conversation::create([
            'is_group'   => true,
            'title'      => $title !== '' ? $title : null,
            'created_by' => $creatorId,
        ]);

        $allParticipantIds = collect($participantIds)->push($creatorId)->unique()->values();
        $now = now();
        $conversation->participants()->attach(
            $allParticipantIds->mapWithKeys(fn ($id) => [
                $id => [
                    'last_read_at' => $id === $creatorId ? $now : null,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ],
            ])->all()
        );

        return $conversation;
    }

    private function createMessage(Conversation $conversation, int $senderId, string $body): Message
    {
        $conversation->participants()->updateExistingPivot($senderId, ['last_read_at' => now()]);

        $message = $conversation->messages()->create([
            'sender_id'   => $senderId,
            'receiver_id' => $conversation->is_group
                ? $conversation->participants()->where('users.id', '!=', $senderId)->value('users.id')
                : $conversation->participants()->where('users.id', '!=', $senderId)->value('users.id'),
            'body'        => $body,
        ]);

        $message->load('sender:id,name,avatar');

        $recipientIds = $conversation->participants()
            ->where('users.id', '!=', $senderId)
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (! empty($recipientIds)) {
            $title = $conversation->is_group
                ? ($conversation->title ?: $message->sender->name)
                : $message->sender->name;

            SendPushNotification::dispatch(
                $recipientIds,
                $title,
                mb_strimwidth($body, 0, 120, '…'),
                [
                    'type' => 'new_message',
                    'conversation_id' => $conversation->id,
                    'user_id' => $senderId,
                ],
            );
        }

        return $message;
    }

    private function findOrCreateDirectConversation(int $me, int $otherUserId): Conversation
    {
        if ($me === $otherUserId) {
            abort(422, 'Cannot message yourself.');
        }

        $conversation = $this->findDirectConversation($me, $otherUserId);

        if ($conversation) {
            return $conversation;
        }

        $conversation = Conversation::create([
            'is_group'   => false,
            'title'      => null,
            'created_by' => $me,
        ]);

        $now = now();
        $conversation->participants()->attach([
            $me          => ['last_read_at' => $now,  'created_at' => $now, 'updated_at' => $now],
            $otherUserId => ['last_read_at' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);

        return $conversation;
    }

    private function findDirectConversation(int $me, int $otherUserId): ?Conversation
    {
        $conversationId = DB::table('conversation_participants')
            ->select('conversation_id')
            ->whereIn('user_id', [$me, $otherUserId])
            ->groupBy('conversation_id')
            ->havingRaw('COUNT(DISTINCT user_id) = 2')
            ->pluck('conversation_id');

        if ($conversationId->isEmpty()) {
            return null;
        }

        return Conversation::query()
            ->where('is_group', false)
            ->whereIn('id', $conversationId)
            ->with('participants:id,name,avatar')
            ->first();
    }

    private function authorizeParticipant(Conversation $conversation, int $userId): void
    {
        abort_unless(
            $conversation->participants()->where('users.id', $userId)->exists(),
            403
        );
    }

    private function ensureGroupConversation(Conversation $conversation): void
    {
        abort_unless($conversation->is_group, 422, 'This action is only available for group conversations.');
    }

    private function authorizeManager(Conversation $conversation, int $userId): void
    {
        abort_unless(
            (int) $conversation->created_by === $userId,
            403,
            'Only the group creator can manage members.'
        );
    }

    private function serializeConversationListItem(Conversation $conversation, int $me): array
    {
        $partner = $conversation->participants->firstWhere('id', '!=', $me);

        return [
            'id'           => $conversation->id,
            'is_group'     => $conversation->is_group,
            'created_by'   => (int) $conversation->created_by,
            'can_manage_members' => $conversation->is_group && (int) $conversation->created_by === $me,
            'title'        => $conversation->is_group
                ? ($conversation->title ?: $conversation->participants->where('id', '!=', $me)->pluck('name')->take(3)->join(', '))
                : null,
            'partner'      => ! $conversation->is_group && $partner ? (new UserResource($partner))->resolve() : null,
            'participants' => UserResource::collection($conversation->participants->values())->resolve(),
            'last_message' => [
                'body'       => $conversation->latestMessage->body,
                'is_mine'    => (int) $conversation->latestMessage->sender_id === $me,
                'created_at' => $conversation->latestMessage->created_at->toIso8601String(),
                'sender'     => [
                    'id'     => $conversation->latestMessage->sender->id,
                    'name'   => $conversation->latestMessage->sender->name,
                    'avatar' => $conversation->latestMessage->sender->avatar,
                ],
            ],
            'unread_count' => (int) $conversation->unread_count,
        ];
    }

    private function serializeConversationDetail(Conversation $conversation, int $me): array
    {
        $partner = $conversation->participants->firstWhere('id', '!=', $me);

        return [
            'id'           => $conversation->id,
            'is_group'     => $conversation->is_group,
            'created_by'   => (int) $conversation->created_by,
            'can_manage_members' => $conversation->is_group && (int) $conversation->created_by === $me,
            'title'        => $conversation->is_group
                ? ($conversation->title ?: $conversation->participants->where('id', '!=', $me)->pluck('name')->take(3)->join(', '))
                : ($partner?->name ?? 'Conversation'),
            'partner'      => ! $conversation->is_group && $partner ? (new UserResource($partner))->resolve() : null,
            'participants' => UserResource::collection($conversation->participants->values())->resolve(),
        ];
    }

    private function serializeMessage(Message $message, int $me): array
    {
        return [
            'id'         => $message->id,
            'body'       => $message->body,
            'is_mine'    => $message->sender_id === $me,
            'created_at' => $message->created_at->toIso8601String(),
            'sender'     => [
                'id'     => $message->sender->id,
                'name'   => $message->sender->name,
                'avatar' => $message->sender->avatar,
            ],
        ];
    }
}
