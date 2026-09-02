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

    /**
     * $notify defaults false like storeStravaActivity — Huawei has no real-time webhook
     * here, every sync goes through backfill/resync which shouldn't spam a push per
     * historical activity.
     *
     * Field mapping confirmed 2026-09-01 against a real activityRecord response: metrics
     * live in activitySummary.dataSummary, a flat array of {dataTypeName, value: [...]}
     * entries rather than a single summary object (Strava's shape doesn't apply here).
     */
    public function storeHuaweiActivity(User $user, array $activity, bool $notify = false): ?Training
    {
        $externalId = isset($activity['id']) ? (string) $activity['id'] : null;
        $startTimeMs = $activity['startTime'] ?? null;
        if (!$externalId || !$startTimeMs) {
            return null;
        }

        $rawType = $activity['activityType'] ?? null;

        // Huawei's cloud API never sends a real user-chosen title: `name`/`desc` are
        // both always the same auto-generated "sportHealth<startTimeMs>" placeholder,
        // identical to `id` (confirmed 2026-09-02 against real synced accounts) — fall
        // through to the app's own `name ?? category.label()` display instead of
        // storing that placeholder as if it meant something.
        $rawName = $activity['name'] ?? null;

        $training = Training::updateOrCreate(
            ['provider' => 'huawei', 'external_id' => $externalId],
            [
                'user_id'        => $user->id,
                'category'       => $this->mapHuaweiCategory($rawType)->value,
                'raw_type'       => $rawType !== null ? (string) $rawType : null,
                'name'           => ($rawName !== null && $rawName !== $externalId) ? $rawName : null,
                'started_at'     => Carbon::createFromTimestampMs((int) $startTimeMs),
                // activeTime excludes paused time, mirroring Strava's moving_time.
                'duration_s'     => isset($activity['activeTime']) ? (int) round($activity['activeTime'] / 1000) : null,
                'distance_m'     => $this->huaweiDataValue($activity, 'com.huawei.continuous.distance.total', 'distance'),
                // Not present on any sample seen yet — Huawei's altitude/elevation
                // dataTypeName is unconfirmed, left null until a hilly activity surfaces one.
                'elevation_gain' => null,
                'avg_heartrate'  => $this->huaweiDataValue($activity, 'com.huawei.continuous.exercise_heart_rate.statistics', 'avg')
                    ?? $this->huaweiDataValue($activity, 'com.huawei.continuous.heart_rate.statistics', 'avg'),
                'max_heartrate'  => $this->huaweiDataValue($activity, 'com.huawei.continuous.exercise_heart_rate.statistics', 'max')
                    ?? $this->huaweiDataValue($activity, 'com.huawei.continuous.heart_rate.statistics', 'max'),
                // "burnt.total" is the activity's own calorie burn; deliberately not adding
                // resting_calories.statistics on top (that's baseline BMR, not the workout).
                'calories'       => $this->huaweiDataValue($activity, 'com.huawei.continuous.calories.burnt.total', 'calories_total'),
                'avg_speed_mps'  => $this->huaweiDataValue($activity, 'com.huawei.continuous.speed.statistics', 'avg'),
                'max_speed_mps'  => $this->huaweiDataValue($activity, 'com.huawei.continuous.speed.statistics', 'max'),
            ],
        );

        if ($notify && $training->wasRecentlyCreated) {
            $this->notifyNewTraining($training);
        }

        $this->dedupe($training);

        return $training;
    }

    /**
     * Reads a single field out of an activityRecord's activitySummary.dataSummary array,
     * e.g. huaweiDataValue($activity, 'com.huawei.continuous.distance.total', 'distance').
     */
    private function huaweiDataValue(array $activity, string $dataTypeName, string $fieldName): ?float
    {
        foreach ($activity['activitySummary']['dataSummary'] ?? [] as $entry) {
            if (($entry['dataTypeName'] ?? null) !== $dataTypeName) {
                continue;
            }

            foreach ($entry['value'] ?? [] as $field) {
                if (($field['fieldName'] ?? null) === $fieldName) {
                    return $field['floatValue'] ?? $field['integerValue'] ?? null;
                }
            }
        }

        return null;
    }

    /**
     * Huawei's ActivityRecord `activityType` isn't documented anywhere publicly (their
     * own doc site doesn't list numeric values, and no third-party reverse-engineering
     * of the cloud REST API's code table was found) — codes below were confirmed one at
     * a time against a real account's own activity history on 2026-09-02. Extend this
     * match as more codes get confirmed; don't guess ahead of confirmation (a run
     * silently showing as cycling is worse than everything showing as Other).
     */
    public function mapHuaweiCategory(mixed $rawType): Category
    {
        return match ((string) $rawType) {
            '57' => Category::Running, // confirmed: indoor running (treadmill, no altitude data)
            '90' => Category::Walking, // confirmed: outdoor walking (has GPS altitude data)
            default => Category::Other,
        };
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

        // A group can shrink to a single member (the other one was deleted) — ungroup it
        // entirely rather than leaving a lone training tagged dedup_group_id/is_merged.
        if ($members->count() === 1) {
            Training::where('id', $members->first()->id)->update(['dedup_group_id' => null, 'is_primary' => true]);

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
