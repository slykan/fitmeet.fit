<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * Prepares a recorded event track for route replay: drops GPS spikes, trims the
 * standing still before the first real movement and after the last one (arriving
 * early, waiting for the group, forgetting to stop sharing), and finds the stops in
 * between so the replay can fast-forward them instead of showing a frozen marker.
 *
 * "Moving" is judged by displacement, not the GPS speed field: standing still the
 * position drifts a few metres a minute and speed_kmh jumps around, but the rider
 * stays inside a small circle.
 */
class TrackCleaner
{
    /** Staying within this radius ... */
    public const STILL_RADIUS_M = 25;

    /** ... for at least this long counts as a stop. */
    public const MIN_STOP_S = 60;

    /** A point reached faster than this, from and back to its neighbours, is a GPS spike. */
    public const SPIKE_KMH = 60;

    /**
     * @param  Collection<int, object{lat: float, lng: float, recorded_at: \Carbon\CarbonInterface}>  $points  ordered by recorded_at
     * @return array{points: Collection, pauses: array<int, array{0: string, 1: string}>}
     */
    public static function clean(Collection $points): array
    {
        $points = self::dropSpikes($points->values());
        $stops = self::stops($points);
        $n = $points->count();

        $from = 0;
        $to = $n - 1;
        // Leading/trailing stop: trim it (keep its first/last point as the start/end position).
        if ($stops && $stops[0][0] === 0) {
            $from = $stops[0][1];
            array_shift($stops);
        }
        if ($stops && end($stops)[1] === $n - 1) {
            $to = end($stops)[0];
            array_pop($stops);
        }
        if ($to <= $from) {
            // Never really moved: keep the raw track rather than nothing.
            return ['points' => $points, 'pauses' => []];
        }

        $pauses = array_map(fn ($s) => [
            $points[$s[0]]->recorded_at->toIso8601String(),
            $points[$s[1]]->recorded_at->toIso8601String(),
        ], $stops);

        return ['points' => $points->slice($from, $to - $from + 1)->values(), 'pauses' => $pauses];
    }

    private static function dropSpikes(Collection $points): Collection
    {
        $kmh = function ($a, $b) {
            $s = max(1, abs($b->recorded_at->getTimestamp() - $a->recorded_at->getTimestamp()));
            return AutoCheckIn::distanceM($a->lat, $a->lng, $b->lat, $b->lng) / $s * 3.6;
        };

        $keep = [];
        $n = $points->count();
        for ($i = 0; $i < $n; $i++) {
            $prev = $keep ? end($keep) : null;
            $next = $points[$i + 1] ?? null;
            if ($prev && $next && $kmh($prev, $points[$i]) > self::SPIKE_KMH && $kmh($points[$i], $next) > self::SPIKE_KMH) {
                continue;
            }
            $keep[] = $points[$i];
        }

        return collect($keep);
    }

    /**
     * Stops as [firstIndex, lastIndex] pairs: runs where every point stays within
     * STILL_RADIUS_M of the run's first point for at least MIN_STOP_S.
     *
     * @return array<int, array{0: int, 1: int}>
     */
    private static function stops(Collection $points): array
    {
        $stops = [];
        $n = $points->count();
        $i = 0;
        while ($i < $n - 1) {
            $j = $i;
            while ($j + 1 < $n
                && AutoCheckIn::distanceM($points[$i]->lat, $points[$i]->lng, $points[$j + 1]->lat, $points[$j + 1]->lng) <= self::STILL_RADIUS_M) {
                $j++;
            }
            if ($j > $i && $points[$j]->recorded_at->getTimestamp() - $points[$i]->recorded_at->getTimestamp() >= self::MIN_STOP_S) {
                $stops[] = [$i, $j];
                $i = $j + 1;
            } else {
                $i++;
            }
        }

        return $stops;
    }
}
