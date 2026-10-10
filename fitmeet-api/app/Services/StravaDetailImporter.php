<?php

namespace App\Services;

use App\Models\Training;
use App\Models\TrainingDetail;

/**
 * Keeps the parts of a Strava activity the app shows in training details (and an AI
 * summary can read): the activity detail minus bulky/irrelevant fields, and the
 * streams downsampled for charts.
 */
class StravaDetailImporter
{
    /** Points kept per stream — plenty for a phone-width chart. */
    public const STREAM_POINTS = 600;

    public const STREAM_KEYS = ['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'];

    private const DETAIL_KEYS = [
        'description', 'device_name', 'trainer', 'commute', 'workout_type', 'sport_type',
        'calories', 'kilojoules', 'average_cadence', 'average_watts', 'max_watts',
        'weighted_average_watts', 'device_watts', 'average_temp', 'average_speed', 'max_speed',
        'moving_time', 'elapsed_time', 'distance', 'total_elevation_gain', 'elev_high', 'elev_low',
        'average_heartrate', 'max_heartrate', 'perceived_exertion', 'suffer_score', 'start_latlng',
    ];

    private const SPLIT_KEYS = ['split', 'distance', 'elapsed_time', 'moving_time', 'elevation_difference', 'average_speed', 'average_grade_adjusted_speed', 'average_heartrate', 'pace_zone'];

    private const LAP_KEYS = ['lap_index', 'name', 'distance', 'elapsed_time', 'moving_time', 'average_speed', 'max_speed', 'average_heartrate', 'max_heartrate', 'average_cadence', 'average_watts', 'total_elevation_gain'];

    private const EFFORT_KEYS = ['name', 'distance', 'elapsed_time', 'moving_time', 'pr_rank'];

    public function storeDetails(Training $training, array $activity): TrainingDetail
    {
        $details = array_intersect_key($activity, array_flip(self::DETAIL_KEYS));
        $details['splits_metric'] = $this->pick($activity['splits_metric'] ?? [], self::SPLIT_KEYS);
        $details['laps'] = $this->pick($activity['laps'] ?? [], self::LAP_KEYS);
        $details['best_efforts'] = $this->pick($activity['best_efforts'] ?? [], self::EFFORT_KEYS);
        $details['gear'] = isset($activity['gear']['name']) ? ['name' => $activity['gear']['name']] : null;
        $details['summary_polyline'] = $activity['map']['summary_polyline'] ?? null;

        return TrainingDetail::updateOrCreate(
            ['training_id' => $training->id],
            ['details' => $details, 'details_fetched_at' => now()],
        );
    }

    /** @param array<string, array{data: array}> $streams Strava streams keyed by type */
    public function storeStreams(Training $training, array $streams): TrainingDetail
    {
        $time = $streams['time']['data'] ?? [];
        $n = count($time);
        $keep = $this->sampleIndexes($n, self::STREAM_POINTS);

        $out = ['points' => count($keep), 'source_points' => $n];
        foreach (self::STREAM_KEYS as $key) {
            $data = $streams[$key]['data'] ?? null;
            if (!is_array($data) || count($data) !== $n) {
                continue;
            }
            $out[$key] = array_map(fn ($i) => $this->round($key, $data[$i]), $keep);
        }

        return TrainingDetail::updateOrCreate(
            ['training_id' => $training->id],
            ['streams' => $out, 'streams_fetched_at' => now()],
        );
    }

    /** @return int[] evenly spaced indexes, first and last always included */
    private function sampleIndexes(int $n, int $max): array
    {
        if ($n <= $max) {
            return range(0, max(0, $n - 1));
        }
        $step = ($n - 1) / ($max - 1);

        return array_values(array_unique(array_map(fn ($k) => (int) round($k * $step), range(0, $max - 1))));
    }

    private function round(string $key, mixed $v): mixed
    {
        return match ($key) {
            'latlng'          => is_array($v) ? [round($v[0], 5), round($v[1], 5)] : null,
            'moving'          => (bool) $v,
            'velocity_smooth' => round((float) $v, 2),
            'altitude', 'distance', 'grade_smooth' => round((float) $v, 1),
            default           => is_numeric($v) ? (int) round($v) : $v,
        };
    }

    private function pick(array $rows, array $keys): array
    {
        return array_values(array_map(fn ($row) => array_intersect_key((array) $row, array_flip($keys)), $rows));
    }
}
