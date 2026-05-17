<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\Event;
use App\Models\EventComment;
use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserPushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function publicLatest(): JsonResponse
    {
        $users = User::latest()->limit(10)->get(['id', 'name', 'avatar']);

        return response()->json([
            'data' => $users->map(fn ($u) => [
                'id'     => $u->id,
                'name'   => $u->name,
                'avatar' => $u->avatar,
            ]),
        ]);
    }

    public function publicStats(): JsonResponse
    {
        $lastUser = User::latest()->first(['name']);

        return response()->json([
            'users_count'    => User::count(),
            'last_user_name' => $lastUser?->name,
            'events_count'   => Event::count(),
            'comments_count' => EventComment::count(),
        ]);
    }

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

        $sort      = $request->input('sort', 'latest');
        $direction = $request->input('direction', $sort === 'name' ? 'asc' : 'desc');
        $dir       = $direction === 'asc' ? 'asc' : 'desc';

        if ($sort === 'beer') {
            $query->orderByRaw("(SELECT COALESCE(SUM(CASE product_id WHEN 'beer_large' THEN 3 WHEN 'beer_medium' THEN 2 ELSE 1 END), 0) FROM beer_donations WHERE user_id = users.id) " . ($dir === 'asc' ? 'ASC' : 'DESC'))
                  ->orderByDesc('created_at');
        } elseif ($sort === 'name') {
            $query->orderBy('name', $dir);
        } elseif ($sort === 'events') {
            $query->withCount('events')->orderBy('events_count', $dir)->orderByDesc('created_at');
        } else {
            $query->orderBy('created_at', $dir)->orderBy('id', $dir);
        }

        $users = $query->withCount('events')->paginate(30);

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

        $userIds    = collect($users->items())->pluck('id');
        $beerByUser = \App\Models\BeerDonation::whereIn('user_id', $userIds)
            ->select('user_id', 'product_id')
            ->get()
            ->groupBy('user_id');
        $tierWeight = ['beer_small' => 1, 'beer_medium' => 2, 'beer_large' => 3];

        $data = collect($users->items())->map(function ($user) use ($statusMap, $beerByUser, $tierWeight, $request) {
            $resource = (new UserResource($user))->toArray($request);
            $resource['friendship_status'] = $statusMap[$user->id] ?? null;
            $resource['events_count'] = $user->events_count ?? 0;

            $donations = $beerByUser[$user->id] ?? collect();
            $resource['beer_score'] = $donations->sum(fn ($d) => $tierWeight[$d->product_id] ?? 1);
            $resource['beer_top_tier'] = $donations->isEmpty() ? null
                : $donations->sortByDesc(fn ($d) => $tierWeight[$d->product_id] ?? 0)->first()->product_id;

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

    public function upsertPushToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:4096'],
            'platform' => ['sometimes', 'nullable', 'string', 'max:24'],
            'device_name' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        UserPushToken::updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $data['platform'] ?? null,
                'device_name' => $data['device_name'] ?? null,
                'last_seen_at' => now(),
            ],
        );

        return response()->json(['message' => 'Push token saved.']);
    }

    public function destroyPushToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:4096'],
        ]);

        UserPushToken::query()
            ->where('user_id', $request->user()->id)
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['message' => 'Push token removed.']);
    }

    public function recordInviteTap(Request $request): \Illuminate\Http\Response
    {
        $request->user()->increment('invite_taps');
        return response()->noContent();
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
