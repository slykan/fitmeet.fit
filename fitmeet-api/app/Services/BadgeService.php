<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\Event;
use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserBadge;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BadgeService
{
    /**
     * Evaluate all badge criteria for the user, persist any newly-earned
     * badges, and (optionally) notify. Returns the list of newly unlocked
     * badges (empty if none). Safe to call repeatedly — already-unlocked
     * badges are never re-created or re-notified.
     */
    public function evaluate(User $user, bool $notify = true): array
    {
        $existingKeys = $user->badges()->pluck('badge_key')->all();

        $agg = $this->computeAggregates($user);
        $earnedKeys = $this->earnedKeys($agg);
        $newKeys = array_diff($earnedKeys, $existingKeys);

        if (empty($newKeys)) {
            return [];
        }

        $now = now();
        $newlyUnlocked = [];

        foreach ($newKeys as $key) {
            $badge = UserBadge::firstOrCreate(
                ['user_id' => $user->id, 'badge_key' => $key],
                ['unlocked_at' => $now]
            );

            if ($badge->wasRecentlyCreated) {
                $newlyUnlocked[] = array_merge(
                    ['key' => $key, 'unlocked_at' => $badge->unlocked_at->toIso8601String()],
                    BadgeCatalog::find($key)
                );
            }
        }

        if ($notify && !empty($newlyUnlocked)) {
            $this->notify($user, $newlyUnlocked);
        }

        return $newlyUnlocked;
    }

    /**
     * Full badge catalog merged with the given user's unlocked state, in
     * catalog order — used to render the profile badge grid (locked +
     * unlocked tiles).
     */
    public function catalogFor(User $user): array
    {
        $unlocked = $user->badges()->pluck('unlocked_at', 'badge_key');

        return collect(BadgeCatalog::all())
            ->map(function (array $badge, string $key) use ($unlocked) {
                return array_merge($badge, [
                    'key' => $key,
                    'unlocked' => $unlocked->has($key),
                    'unlocked_at' => $unlocked->has($key) ? Carbon::parse($unlocked->get($key))->toIso8601String() : null,
                ]);
            })
            ->values()
            ->all();
    }

    private function notify(User $user, array $newlyUnlocked): void
    {
        $count = count($newlyUnlocked);
        $first = $newlyUnlocked[0];

        $title = $count > 1 ? "You unlocked {$count} badges!" : 'New badge unlocked!';
        $body = $count > 1
            ? implode(', ', array_map(fn ($b) => "{$b['emoji']} {$b['name']}", $newlyUnlocked))
            : "You earned {$first['emoji']} {$first['name']}";

        SendPushNotification::dispatch(
            [$user->id],
            $title,
            $body,
            [
                'type' => 'badge_unlocked',
                'badge_keys' => implode(',', array_column($newlyUnlocked, 'key')),
            ],
        );
    }

    private function earnedKeys(array $agg): array
    {
        $keys = [];

        if ($agg['joined_count'] >= 1) $keys[] = 'first_move';
        if ($agg['organized_count'] >= 1) $keys[] = 'organizer';
        if ($agg['joined_count'] >= 10) $keys[] = 'regular';
        if ($agg['joined_count'] >= 50) $keys[] = 'veteran';
        if ($agg['total_distance'] >= 10) $keys[] = 'club_10k';
        if ($agg['total_distance'] >= 50) $keys[] = 'club_50k';
        if ($agg['max_distance'] >= 100) $keys[] = 'century';
        if ($agg['total_elevation'] >= 1000) $keys[] = 'peak_bagger';
        if ($agg['on_fire']) $keys[] = 'on_fire';
        if ($agg['unstoppable']) $keys[] = 'unstoppable';
        if ($agg['friends_count'] >= 5) $keys[] = 'connector';
        if ($agg['organized_count'] >= 5) $keys[] = 'host';
        if ($agg['max_event_participants'] >= 20) $keys[] = 'crowd_puller';
        if ($agg['categories_count'] >= 3) $keys[] = 'explorer';
        if ($agg['early_bird']) $keys[] = 'early_bird';
        if ($agg['night_owl']) $keys[] = 'night_owl';

        return $keys;
    }

    private function computeAggregates(User $user): array
    {
        $joinedEventIds = DB::table('event_participants')
            ->where('user_id', $user->id)
            ->where('status', 'joined')
            ->pluck('event_id');

        $organizedEvents = Event::query()
            ->where('user_id', $user->id)
            ->get(['id', 'category', 'distance_km', 'elevation_gain', 'start_at', 'timezone', 'participants_count']);

        $joinedEvents = $joinedEventIds->isEmpty()
            ? collect()
            : Event::query()
                ->whereIn('id', $joinedEventIds)
                ->get(['id', 'category', 'distance_km', 'elevation_gain', 'start_at', 'timezone']);

        $allEvents = $joinedEvents->concat($organizedEvents)->unique('id');

        $categories = $allEvents->pluck('category')->filter()->map(fn ($c) => $c->value ?? $c)->unique();

        $earlyBird = false;
        $nightOwl = false;
        foreach ($allEvents as $event) {
            if (! $event->start_at) continue;
            $tz = $event->timezone ?: config('app.event_timezone', 'UTC');
            $hour = (int) Carbon::parse($event->start_at)->setTimezone($tz)->format('H');
            if ($hour < 7) $earlyBird = true;
            if ($hour >= 21) $nightOwl = true;
        }

        $friendsCount = FriendRequest::where('status', 'accepted')
            ->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            })->count();

        $activeWeeks = $this->activeWeeks($user, $organizedEvents);

        return [
            'joined_count' => $joinedEventIds->count(),
            'organized_count' => $organizedEvents->count(),
            'total_distance' => (float) $allEvents->sum('distance_km'),
            'max_distance' => (float) ($allEvents->max('distance_km') ?? 0),
            'total_elevation' => (float) $allEvents->sum('elevation_gain'),
            'categories_count' => $categories->count(),
            'early_bird' => $earlyBird,
            'night_owl' => $nightOwl,
            'friends_count' => $friendsCount,
            'max_event_participants' => (int) ($organizedEvents->max('participants_count') ?? 0),
            'on_fire' => $this->hasConsecutiveActiveWeeks($activeWeeks, 2),
            'unstoppable' => $this->hasConsecutiveActiveWeeks($activeWeeks, 4),
        ];
    }

    /**
     * Distinct ISO year-weeks (format YYYYWW, matching Carbon's 'oW') in
     * which the user either joined or organized an event.
     */
    private function activeWeeks(User $user, Collection $organizedEvents): Collection
    {
        $joinedWeeks = DB::table('event_participants')
            ->where('user_id', $user->id)
            ->where('status', 'joined')
            ->selectRaw('DISTINCT YEARWEEK(joined_at, 3) as yw')
            ->pluck('yw')
            ->map(fn ($yw) => (int) $yw);

        $organizedWeeks = $organizedEvents
            ->filter(fn ($e) => $e->start_at)
            ->map(fn ($e) => (int) Carbon::parse($e->start_at)->format('oW'));

        return $joinedWeeks->concat($organizedWeeks)->unique();
    }

    private function hasConsecutiveActiveWeeks(Collection $activeWeeks, int $n): bool
    {
        if ($activeWeeks->count() < $n) {
            return false;
        }

        $weekSet = $activeWeeks->flip();
        $now = Carbon::now();

        for ($i = 0; $i < $n; $i++) {
            $yw = (int) $now->copy()->subWeeks($i)->format('oW');
            if (! $weekSet->has($yw)) {
                return false;
            }
        }

        return true;
    }
}
