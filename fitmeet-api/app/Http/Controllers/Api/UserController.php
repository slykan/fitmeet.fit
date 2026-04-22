<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $me    = $request->user();
        $query = User::where('id', '!=', $me->id);

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('skill_level')) {
            $query->where('skill_level', $request->skill_level);
        }

        $users = $query->orderBy('name')->paginate(30);

        // Build a map of userId → friendship status for the current user
        $statusMap = [];
        try {
            $userIds  = collect($users->items())->pluck('id');
            $requests = FriendRequest::where(function ($q) use ($me, $userIds) {
                $q->where('sender_id', $me->id)->whereIn('receiver_id', $userIds);
            })->orWhere(function ($q) use ($me, $userIds) {
                $q->where('receiver_id', $me->id)->whereIn('sender_id', $userIds);
            })->get();

            foreach ($requests as $r) {
                $otherId = $r->sender_id === $me->id ? $r->receiver_id : $r->sender_id;
                if ($r->status === 'accepted') {
                    $statusMap[$otherId] = 'friends';
                } elseif ($r->status === 'pending') {
                    $statusMap[$otherId] = $r->sender_id === $me->id ? 'pending_sent' : 'pending_received';
                }
            }
        } catch (\Throwable) {
            // friend_requests table may not exist yet — degrade gracefully
        }

        $data = collect($users->items())->map(function ($user) use ($statusMap, $request) {
            $resource = (new UserResource($user))->toArray($request);
            $resource['friendship_status'] = $statusMap[$user->id] ?? null;
            return $resource;
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
                'total'        => $users->total(),
            ],
        ]);
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = auth()->user();
        $user->update($request->validated());

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }
}
