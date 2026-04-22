<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
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
        $count = Message::where('receiver_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    // GET /messages — list conversations (one entry per friend, latest message)
    public function index(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $rows = DB::select("
            SELECT
                m.*,
                CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id,
                (
                    SELECT COUNT(*) FROM messages u
                    WHERE u.receiver_id = ? AND u.sender_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
                    AND u.read_at IS NULL
                ) AS unread_count
            FROM messages m
            INNER JOIN (
                SELECT MAX(id) AS max_id
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
            ) latest ON m.id = latest.max_id
            ORDER BY m.created_at DESC
        ", [$me, $me, $me, $me, $me]);

        $partnerIds = array_unique(array_column($rows, 'partner_id'));
        $partners   = User::whereIn('id', $partnerIds)->get()->keyBy('id');

        $data = collect($rows)->map(fn ($r) => [
            'partner'      => new UserResource($partners[$r->partner_id]),
            'last_message' => [
                'body'       => $r->body,
                'is_mine'    => (int) $r->sender_id === $me,
                'created_at' => $r->created_at,
            ],
            'unread_count' => (int) $r->unread_count,
        ]);

        return response()->json(['data' => $data]);
    }

    // GET /messages/{user} — full thread, marks messages as read
    public function thread(Request $request, User $user): JsonResponse
    {
        $me = $request->user()->id;

        // Mark incoming messages as read
        Message::where('sender_id', $user->id)
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $messages = Message::where(function ($q) use ($me, $user) {
            $q->where('sender_id', $me)->where('receiver_id', $user->id);
        })->orWhere(function ($q) use ($me, $user) {
            $q->where('sender_id', $user->id)->where('receiver_id', $me);
        })
        ->orderBy('created_at')
        ->get()
        ->map(fn ($m) => [
            'id'         => $m->id,
            'body'       => $m->body,
            'is_mine'    => $m->sender_id === $me,
            'created_at' => $m->created_at->toIso8601String(),
            'read_at'    => $m->read_at?->toIso8601String(),
        ]);

        return response()->json([
            'partner' => new UserResource($user),
            'data'    => $messages,
        ]);
    }

    // POST /messages/{user} — send a message
    public function send(Request $request, User $user): JsonResponse
    {
        $request->validate(['body' => 'required|string|max:2000']);

        $message = Message::create([
            'sender_id'   => $request->user()->id,
            'receiver_id' => $user->id,
            'body'        => $request->body,
        ]);

        return response()->json([
            'data' => [
                'id'         => $message->id,
                'body'       => $message->body,
                'is_mine'    => true,
                'created_at' => $message->created_at->toIso8601String(),
                'read_at'    => null,
            ],
        ], 201);
    }
}
