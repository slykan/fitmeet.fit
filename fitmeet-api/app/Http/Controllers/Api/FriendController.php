<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\FriendAcceptedMail;
use App\Mail\FriendRequestMail;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class FriendController extends Controller
{
    // POST /friends/request/{user}
    public function request(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        if ($me->id === $user->id) {
            return response()->json(['message' => 'Cannot add yourself.'], 422);
        }

        $existing = FriendRequest::where(function ($q) use ($me, $user) {
            $q->where('sender_id', $me->id)->where('receiver_id', $user->id);
        })->orWhere(function ($q) use ($me, $user) {
            $q->where('sender_id', $user->id)->where('receiver_id', $me->id);
        })->first();

        if ($existing) {
            return response()->json(['message' => 'Request already exists.', 'status' => $existing->status], 422);
        }

        FriendRequest::create([
            'sender_id'   => $me->id,
            'receiver_id' => $user->id,
            'status'      => 'pending',
        ]);

        try {
            Mail::to($user->email)->send(new FriendRequestMail($me, $user));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Friend request sent.']);
    }

    // DELETE /friends/cancel/{user}  — sender cancels their own pending request
    public function cancel(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        FriendRequest::where('sender_id', $me->id)
            ->where('receiver_id', $user->id)
            ->where('status', 'pending')
            ->delete();

        return response()->json(['message' => 'Request cancelled.']);
    }

    // POST /friends/accept/{friendRequest}
    public function accept(Request $request, FriendRequest $friendRequest): JsonResponse
    {
        $this->authorizeReceiver($request, $friendRequest);
        $friendRequest->load('sender');
        $friendRequest->update(['status' => 'accepted']);

        try {
            Mail::to($friendRequest->sender->email)
                ->send(new FriendAcceptedMail($request->user(), $friendRequest->sender));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Friend request accepted.']);
    }

    // POST /friends/decline/{friendRequest}
    public function decline(Request $request, FriendRequest $friendRequest): JsonResponse
    {
        $this->authorizeReceiver($request, $friendRequest);
        $friendRequest->update(['status' => 'declined']);
        return response()->json(['message' => 'Friend request declined.']);
    }

    // GET /notifications
    public function notifications(Request $request): JsonResponse
    {
        $me = $request->user();

        $requests = FriendRequest::with('sender')
            ->where('receiver_id', $me->id)
            ->where('status', 'pending')
            ->latest()
            ->get();

        $data = $requests->map(fn ($r) => [
            'id'         => $r->id,
            'type'       => 'friend_request',
            'sender'     => new UserResource($r->sender),
            'created_at' => $r->created_at->toDateTimeString(),
        ]);

        return response()->json(['data' => $data]);
    }

    // DELETE /friends/{user}  — remove accepted friend
    public function remove(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        FriendRequest::where(function ($q) use ($me, $user) {
            $q->where('sender_id', $me->id)->where('receiver_id', $user->id);
        })->orWhere(function ($q) use ($me, $user) {
            $q->where('sender_id', $user->id)->where('receiver_id', $me->id);
        })->delete();

        return response()->json(['message' => 'Friend removed.']);
    }

    private function authorizeReceiver(Request $request, FriendRequest $friendRequest): void
    {
        if ($friendRequest->receiver_id !== $request->user()->id) {
            abort(403);
        }
    }
}
