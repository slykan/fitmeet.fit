<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        // friends_only — only users with accepted friendship
        if ($request->boolean('friends_only')) {
            $friendIds = FriendRequest::where(function ($q) use ($me) {
                $q->where('sender_id', $me->id)->orWhere('receiver_id', $me->id);
            })->where('status', 'accepted')
              ->get()
              ->map(fn ($r) => $r->sender_id === $me->id ? $r->receiver_id : $r->sender_id);

            $query->whereIn('id', $friendIds);
        }

        $users = $query->withCount('events')->orderBy('name')->paginate(30);

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
            $resource['events_count'] = $user->events_count ?? 0;
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
        $data = $request->validated();

        if ($request->boolean('avatar_remove')) {
            $this->deleteStoredAvatar($user->avatar);
            $data['avatar'] = null;
        }

        if ($request->hasFile('avatar_file')) {
            $this->deleteStoredAvatar($user->avatar);
            $path = $request->file('avatar_file')->store('avatars', 'public');
            $data['avatar'] = Storage::disk('public')->url($path);
        }

        unset($data['avatar_file'], $data['avatar_remove']);

        $user->update($data);
        $user->refresh();

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }

    // POST /api/me/avatar — dedicated avatar upload (avoids _method spoofing issues)
    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar_file'   => ['sometimes', 'nullable', 'file', 'max:8192'],
            'avatar_remove' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        if ($request->boolean('avatar_remove')) {
            $this->deleteStoredAvatar($user->avatar);
            $user->update(['avatar' => null]);
        } elseif ($request->hasFile('avatar_file')) {
            $this->deleteStoredAvatar($user->avatar);
            $path = $request->file('avatar_file')->store('avatars', 'public');
            $user->update(['avatar' => Storage::disk('public')->url($path)]);
        }

        $user->refresh();
        return response()->json(['data' => new UserResource($user)]);
    }

    private function deleteStoredAvatar(?string $avatarUrl): void
    {
        if (! $avatarUrl) {
            return;
        }

        $path = parse_url($avatarUrl, PHP_URL_PATH);

        if (! is_string($path) || ! Str::contains($path, '/storage/avatars/')) {
            return;
        }

        $storagePath = Str::after($path, '/storage/');

        if ($storagePath !== '') {
            Storage::disk('public')->delete($storagePath);
        }
    }
}
