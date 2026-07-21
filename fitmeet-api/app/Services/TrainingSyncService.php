<?php

namespace App\Services;

use App\Enums\Category;
use App\Jobs\SendPushNotification;
use App\Models\ProviderConnection;
use App\Models\Training;
use App\Models\TrainingNotification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class TrainingSyncService
{
    /**
     * $notify should only be true for real-time webhook events — backfill and
     * resync would otherwise fire a notification/push per historical activity.
     */
    public function storeStravaActivity(User $user, array $activity, bool $notify = false): ?Training
    {
        $externalId = isset($activity['id']) ? (string) $activity['id'] : null;
        if (!$externalId || empty($activity['start_date'])) {
            return null;
        }

        $rawType = $activity['sport_type'] ?? $activity['type'] ?? null;

        $training = Training::updateOrCreate(
            ['provider' => 'strava', 'external_id' => $externalId],
            [
                'user_id'        => $user->id,
                'category'       => $this->mapStravaCategory($rawType)->value,
                'raw_type'       => $rawType,
                'name'           => $activity['name'] ?? null,
                'started_at'     => Carbon::parse($activity['start_date']),
                'duration_s'     => $activity['moving_time'] ?? $activity['elapsed_time'] ?? null,
                'distance_m'     => $activity['distance'] ?? null,
                'elevation_gain' => $activity['total_elevation_gain'] ?? null,
                'avg_heartrate'  => $activity['average_heartrate'] ?? null,
                'max_heartrate'  => $activity['max_heartrate'] ?? null,
                'avg_watts'      => $activity['average_watts'] ?? null,
                'max_watts'      => $activity['max_watts'] ?? null,
                'avg_cadence'    => $activity['average_cadence'] ?? null,
                'calories'       => $activity['calories'] ?? null,
                'avg_speed_mps'  => $activity['average_speed'] ?? null,
                'max_speed_mps'  => $activity['max_speed'] ?? null,
                'kilojoules'     => $activity['kilojoules'] ?? null,
                'suffer_score'   => $activity['suffer_score'] ?? null,
                'gear_name'      => $activity['gear']['name'] ?? null,
                'description'    => $activity['description'] ?? null,
            ],
        );

        if ($notify && $training->wasRecentlyCreated) {
            $this->notifyNewTraining($training);
        }

        $this->dedupe($training);

        return $training;
    }

    private function notifyNewTraining(Training $training): void
    {
        TrainingNotification::create([
            'user_id'     => $training->user_id,
            'training_id' => $training->id,
        ]);

        SendPushNotification::dispatch(
            [$training->user_id],
            'New training synced 💪',
            $training->name ?? $training->category->label(),
            ['type' => 'training_synced', 'training_id' => $training->id],
        );
    }

    public function deleteStravaActivity(string $externalId): void
    {
        Training::where('provider', 'strava')->where('external_id', $externalId)->delete();
    }

    public function mapStravaCategory(?string $rawType): Category
    {
        return match ($rawType) {
            'Run', 'TrailRun', 'VirtualRun' => Category::Running,
            'Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'EBikeRide', 'Velomobile', 'Handcycle' => Category::Cycling,
            'Hike' => Category::Hiking,
            'Walk' => Category::Walking,
            'Swim' => Category::Swimming,
            'AlpineSki', 'BackcountrySki', 'NordicSki', 'Snowboard' => Category::Skiing,
            'Surfing', 'Windsurf', 'Kitesurf', 'StandUpPaddling' => Category::Surfing,
            'RockClimbing' => Category::Climbing,
            'IceSkate' => Category::IceSkating,
            'InlineSkate' => Category::InlineSkating,
            'Kayaking', 'Canoeing', 'Rowing' => Category::Kayaking,
            'Soccer' => Category::Football,
            'Basketball' => Category::Basketball,
            'Tennis' => Category::Tennis,
            'Volleyball', 'BeachVolleyball' => Category::Volleyball,
            'Yoga' => Category::Yoga,
            'WeightTraining', 'Workout', 'Crossfit', 'Elliptical', 'StairStepper', 'HighIntensityIntervalTraining', 'Pilates' => Category::Fitness,
            default => Category::Other,
        };
    }

    /**
     * Cross-provider dedup: group trainings for the same user that started within
     * a 5 minute window (and, when both report distance, are within 20% of each
     * other). The provider with the highest priority (lowest number) in the
     * group is marked primary; the rest stay hidden from the default list.
     */
    private function dedupe(Training $training): void
    {
        $candidates = Training::where('user_id', $training->user_id)
            ->where('provider', '!=', $training->provider)
            ->whereBetween('started_at', [
                $training->started_at->copy()->subMinutes(5),
                $training->started_at->copy()->addMinutes(5),
            ])
            ->get()
            ->filter(function (Training $other) use ($training) {
                if (!$training->distance_m || !$other->distance_m) {
                    return true;
                }
                $diff = abs($training->distance_m - $other->distance_m);

                return $diff <= max($training->distance_m, $other->distance_m) * 0.2;
            });

        if ($candidates->isEmpty()) {
            return;
        }

        $groupId = $candidates->first(fn (Training $t) => $t->dedup_group_id !== null)?->dedup_group_id
            ?? $training->dedup_group_id
            ?? (string) Str::uuid();

        $memberIds = $candidates->pluck('id')->push($training->id);
        Training::whereIn('id', $memberIds)->update(['dedup_group_id' => $groupId]);

        $this->recomputePrimary($groupId, $training->user_id);
    }

    private function recomputePrimary(string $groupId, int $userId): void
    {
        $priorities = ProviderConnection::where('user_id', $userId)->pluck('priority', 'provider');

        $members = Training::where('dedup_group_id', $groupId)->get();
        if ($members->isEmpty()) {
            return;
        }

        $primary = $members->sortBy(fn (Training $t) => $priorities[$t->provider] ?? PHP_INT_MAX)->first();

        Training::where('dedup_group_id', $groupId)->update(['is_primary' => false]);
        Training::where('id', $primary->id)->update(['is_primary' => true]);
    }

    /**
     * Re-rank every dedup group for a user, called after provider priority changes.
     */
    public function recomputeAllGroups(int $userId): void
    {
        $groupIds = Training::where('user_id', $userId)
            ->whereNotNull('dedup_group_id')
            ->distinct()
            ->pluck('dedup_group_id');

        foreach ($groupIds as $groupId) {
            $this->recomputePrimary($groupId, $userId);
        }
    }
}
