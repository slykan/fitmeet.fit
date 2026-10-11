<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The user's heart-rate zones — one place for the coach, reports and the apps.
 * Priority: manual bounds › max HR (50/60/70/80/90 %) › 220 − age › highest HR seen.
 */
class HrZones
{
    public const NAMES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
    private const SHARES = [0.5, 0.6, 0.7, 0.8, 0.9];

    /** @return array{bounds: int[]|null, max: int|null, source: string|null} lower bound in bpm of Z1..Z5 */
    public static function forUser(?User $user, ?float $fallbackMax = null): array
    {
        $manual = $user?->hr_zones;
        if (is_array($manual) && count($manual) === 5) {
            return ['bounds' => array_map('intval', $manual), 'max' => $user->hr_max, 'source' => 'manual'];
        }
        if ($user?->hr_max) {
            return ['bounds' => self::fromMax($user->hr_max), 'max' => (int) $user->hr_max, 'source' => 'max'];
        }
        if ($age = $user?->birth_date?->age) {
            return ['bounds' => self::fromMax(220 - $age), 'max' => 220 - $age, 'source' => 'age'];
        }
        if ($fallbackMax) {
            return ['bounds' => self::fromMax((int) $fallbackMax), 'max' => (int) $fallbackMax, 'source' => 'observed'];
        }

        return ['bounds' => null, 'max' => null, 'source' => null];
    }

    /** @return int[] */
    public static function fromMax(int $max): array
    {
        return array_map(fn ($share) => (int) round($max * $share), self::SHARES);
    }

    /** Minutes per zone from a training's streams, or null without heart-rate data. */
    public static function minutes(array $streams, ?array $bounds): ?array
    {
        $hr = $streams['heartrate'] ?? null;
        $time = $streams['time'] ?? null;
        if (!$bounds || !$hr || !$time || count($hr) !== count($time)) {
            return null;
        }
        $secs = array_fill_keys(self::NAMES, 0);
        foreach ($hr as $i => $v) {
            $dt = $i > 0 ? max(0, $time[$i] - $time[$i - 1]) : 0;
            $zone = null;
            foreach ($bounds as $k => $from) {
                if ($v >= $from) {
                    $zone = self::NAMES[$k];
                }
            }
            if ($zone) {
                $secs[$zone] += $dt;
            }
        }

        return array_map(fn ($sec) => (int) round($sec / 60), $secs);
    }

    /** Highest HR in the user's trainings of the last 12 months — a max-HR suggestion. */
    public static function highestRecorded(User $user): ?int
    {
        $max = DB::table('trainings')
            ->where('user_id', $user->id)
            ->where('started_at', '>=', now()->subYear())
            ->max('max_heartrate');

        return $max ? (int) round($max) : null;
    }
}
