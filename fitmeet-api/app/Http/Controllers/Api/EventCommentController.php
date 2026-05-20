<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventCommentResource;
use App\Jobs\SendPushNotification;
use App\Models\Event;
use App\Models\EventComment;
use App\Models\EventNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class EventCommentController extends Controller
{
    public function publicLatest(): JsonResponse
    {
        $comments = EventComment::query()
            ->with(['user:id,name,avatar', 'event:id,title,category'])
            ->whereHas('event', fn ($q) => $q->where('is_private', false)->where('status', 'active'))
            ->where('body', '!=', '')
            ->latest()
            ->limit(9)
            ->get()
            ->map(fn ($c) => [
                'id'          => $c->id,
                'body'        => $c->body,
                'created_at'  => $c->created_at->toIso8601String(),
                'user'        => ['name' => $c->user?->name, 'avatar' => $c->user?->avatar],
                'event'       => ['id' => $c->event?->id, 'title' => $c->event?->title, 'category' => $c->event?->category?->value],
            ]);

        return response()->json($comments);
    }

    public function index(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canAccessWall($event, $user), 403, 'Only the organizer and joined participants can access the Event Wall.');

        EventNotification::where('user_id', $user->id)
            ->where('event_id', $event->id)
            ->whereIn('type', ['event_comment', 'event_comment_mention'])
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $commentCount = EventComment::query()
            ->where('event_id', $event->id)
            ->count();

        $comments = EventComment::query()
            ->with(['user:id,name,avatar', 'event:id,user_id'])
            ->where('event_id', $event->id)
            ->latest()
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        return response()->json([
            'data' => EventCommentResource::collection($comments),
            'meta' => [
                'can_comment' => true,
                'count' => $commentCount,
            ],
        ]);
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canAccessWall($event, $user), 403, 'Only the organizer and joined participants can comment.');

        $data = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
            'mention_user_ids' => ['sometimes', 'array', 'max:20'],
            'mention_user_ids.*' => ['integer', 'exists:users,id', 'distinct'],
        ]);

        $body = trim($data['body']);
        if ($body === '') {
            return response()->json(['message' => 'Comment cannot be empty.'], 422);
        }

        $lastComment = EventComment::query()
            ->where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        if ($lastComment && $lastComment->created_at?->gt(now()->subSeconds(15))) {
            return response()->json(['message' => 'Please wait a few seconds before posting again.'], 429);
        }

        $comment = EventComment::create([
            'event_id' => $event->id,
            'user_id' => $user->id,
            'body' => $body,
        ]);

        $comment->load(['user:id,name,avatar', 'event:id,user_id']);

        $allowedMentionIds = $this->eligibleWallUserIds($event)
            ->filter(fn ($id) => (int) $id !== (int) $user->id);
        $mentionIds = collect($data['mention_user_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->intersect($allowedMentionIds)
            ->unique()
            ->values();

        try {
            $this->notifyRelevantUsers($event, $comment, $mentionIds);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'data' => new EventCommentResource($comment),
        ], 201);
    }

    public function destroy(Request $request, Event $event, EventComment $comment): JsonResponse
    {
        abort_unless((int) $comment->event_id === (int) $event->id, 404);

        $user = $request->user();
        $canDelete = (int) $comment->user_id === (int) $user->id || (int) $event->user_id === (int) $user->id;
        abort_unless($canDelete, 403);

        $comment->delete();

        return response()->json(['message' => 'Comment deleted.']);
    }

    private function canAccessWall(Event $event, $user): bool
    {
        if (! $user) {
            return false;
        }

        if ((int) $event->user_id === (int) $user->id) {
            return true;
        }

        return $event->participants()
            ->where('users.id', $user->id)
            ->exists();
    }

    private function notifyRelevantUsers(Event $event, EventComment $comment, Collection $mentionIds): void
    {
        $recipientIds = EventComment::query()
            ->where('event_id', $event->id)
            ->where('user_id', '!=', $comment->user_id)
            ->distinct()
            ->pluck('user_id')
            ->push($event->user_id)
            ->filter(fn ($id) => (int) $id !== (int) $comment->user_id)
            ->unique()
            ->values();

        foreach ($recipientIds as $recipientId) {
            EventNotification::where('user_id', $recipientId)
                ->where('event_id', $event->id)
                ->whereIn('type', ['event_comment', 'event_comment_mention'])
                ->delete();

            EventNotification::create([
                'user_id' => $recipientId,
                'event_id' => $event->id,
                'type' => $mentionIds->contains((int) $recipientId) ? 'event_comment_mention' : 'event_comment',
                'read_at' => null,
            ]);
        }

        if ($mentionIds->isNotEmpty()) {
            SendPushNotification::dispatch(
                $mentionIds->all(),
                'You were mentioned',
                "{$comment->user->name} mentioned you in {$event->title}.",
                [
                    'type' => 'event_comment_mention',
                    'event_id' => $event->id,
                ],
            );
        }
    }

    private function eligibleWallUserIds(Event $event): Collection
    {
        return $event->participants()
            ->pluck('users.id')
            ->push($event->user_id)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }
}
