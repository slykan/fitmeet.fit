<?php

namespace App\Services;

use App\Models\HealthDay;
use App\Models\Meal;
use App\Models\Training;
use App\Models\User;
use Carbon\Carbon;

/**
 * Health: basal metabolic rate and estimated daily energy expenditure from the profile
 * (sex, age from birth_date, weight, height, optional body fat, average steps) and synced trainings.
 *
 * BMR: Katch-McArdle when body fat is known (better for athletes), otherwise Mifflin-St Jeor
 * ("na" sex = average of the male and female formula).
 * Day total = BMR + steps + trainings + thermic effect of food (~10 % of the rest).
 * Trainings without calories are estimated: Keytel (avg HR) › MET × kg × hours.
 */
class HealthProfile
{
    /** Fields the Health form must have before anything can be calculated. */
    public const REQUIRED = ['sex', 'birth_date', 'weight_kg', 'height_cm'];

    // kcal per step per kg of body weight (≈ 0.04 kcal/step at 75 kg, normal walking pace)
    private const KCAL_PER_STEP_KG = 0.0005;
    private const TEF = 0.10;

    // MET for a moderate session, used only when a training has neither calories nor heart rate
    private const MET = [
        'running' => 9.8, 'cycling' => 7.5, 'hiking' => 6.0, 'swimming' => 7.0, 'football' => 7.0,
        'basketball' => 6.5, 'tennis' => 7.3, 'volleyball' => 4.0, 'yoga' => 2.8, 'fitness' => 5.0,
        'martial_arts' => 7.8, 'skiing' => 6.0, 'surfing' => 3.0, 'climbing' => 7.5, 'padel' => 6.0,
        'ice_skating' => 5.5, 'inline_skating' => 7.5, 'walking' => 3.5, 'rowing' => 7.0, 'kayaking' => 5.0,
    ];

    /** Days start at local midnight (the app itself runs in UTC; DB times are UTC). */
    public static function tz(): string
    {
        return (string) config('app.event_timezone', 'Europe/Zagreb');
    }

    public static function missing(User $user): array
    {
        return array_values(array_filter(self::REQUIRED, fn ($f) => $user->{$f} === null || $user->{$f} === ''));
    }

    /** @return array{kcal: int, formula: string}|null */
    public static function bmr(User $user): ?array
    {
        if (self::missing($user)) {
            return null;
        }
        $w = (float) $user->weight_kg;
        if ($user->body_fat_pct) {
            $lean = $w * (1 - $user->body_fat_pct / 100);
            return ['kcal' => (int) round(370 + 21.6 * $lean), 'formula' => 'katch_mcardle'];
        }
        $base = 10 * $w + 6.25 * $user->height_cm - 5 * $user->birth_date->age;
        $sexTerm = ['male' => 5, 'female' => -161][$user->sex] ?? -78;

        return ['kcal' => (int) round($base + $sexTerm), 'formula' => 'mifflin_st_jeor'];
    }

    /** Estimated kcal of one training (synced value first). @return array{kcal: int, source: string} */
    public static function trainingKcal(Training $t, ?User $user): array
    {
        if ($t->calories) {
            return ['kcal' => (int) round($t->calories), 'source' => 'device'];
        }
        $min = ($t->duration_s ?? 0) / 60;
        $w = $user?->weight_kg;
        $age = $user?->birth_date?->age;
        if ($min > 0 && $t->avg_heartrate && $w && $age && in_array($user->sex, ['male', 'female'], true)) {
            $hr = (float) $t->avg_heartrate;
            $perMin = $user->sex === 'male'
                ? (-55.0969 + 0.6309 * $hr + 0.1988 * $w + 0.2017 * $age) / 4.184
                : (-20.4022 + 0.4472 * $hr - 0.1263 * $w + 0.074 * $age) / 4.184;
            if ($perMin > 0) {
                return ['kcal' => (int) round($perMin * $min), 'source' => 'heart_rate'];
            }
        }
        $met = self::MET[$t->category->value] ?? 5.0;

        return ['kcal' => (int) round($met * ($w ?: 75) * $min / 60), 'source' => 'estimate'];
    }

    /**
     * Everything the Health screen and the AI coach need, for one calendar day (app timezone).
     * "today" = the chosen day (default today); "week" = average day of the 7 days ending on it.
     */
    public static function summary(User $user, ?Carbon $date = null): array
    {
        $tz = self::tz();
        $date = ($date ?? now($tz))->copy()->tz($tz)->startOfDay();
        $bmr = self::bmr($user);
        $missing = self::missing($user);

        $base = [
            'complete'   => ! $missing,
            'missing'    => $missing,
            'profile'    => self::inputs($user),
            'updated_at' => $user->health_updated_at?->toIso8601String(),
            'date'       => $date->toDateString(),
            'is_today'   => $date->isSameDay(now($tz)),
        ];
        if (! $bmr) {
            return $base + ['bmr' => null, 'today' => null, 'week' => null];
        }

        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $days[] = self::day($user, $date->copy()->subDays($i), $bmr['kcal']);
        }
        $avg = fn (string $k, int $p = 0) => round(array_sum(array_column($days, $k)) / 7, $p);
        $week = [
            'bmr' => (int) $avg('bmr'), 'steps' => (int) $avg('steps'), 'training' => (int) $avg('training'),
            'food' => (int) $avg('food'), 'total' => (int) $avg('total'), 'trainings' => $avg('trainings', 1),
            'estimated' => (bool) array_filter(array_column($days, 'estimated')),
            // eaten: average over days that have food logged (empty days would only drag it down)
            'intake' => ($logged = array_filter($days, fn ($d) => $d['intake'] > 0))
                ? (int) round(array_sum(array_column($logged, 'intake')) / count($logged)) : 0,
            'logged_days' => count($logged),
        ];

        return $base + [
            'bmr'   => $bmr,
            'today' => end($days),
            'week'  => $week,
            'w_per_kg' => $user->ftp_w ? round($user->ftp_w / $user->weight_kg, 2) : null,
        ];
    }

    /**
     * One day: burned (BMR + steps + trainings + thermic effect of food) and eaten (meals).
     * Past days come from the health_days snapshot when there is one; today (or a past day
     * seen for the first time) is calculated and the snapshot saved.
     */
    public static function day(User $user, Carbon $day, ?int $bmrKcal = null, bool $recalculate = false): array
    {
        $tz = self::tz();
        $day = $day->copy()->tz($tz)->startOfDay();
        $today = now($tz)->startOfDay();
        if ($day->gt($today)) {
            return self::emptyDay($bmrKcal ?? 0);
        }

        $snap = HealthDay::where('user_id', $user->id)->whereDate('day', $day->toDateString())->first();
        $meals = Meal::where('user_id', $user->id)->whereDate('eaten_on', $day->toDateString())->get();
        $eaten = [
            'intake'    => (int) $meals->sum('kcal'),
            'protein_g' => round($meals->sum('protein_g'), 1),
            'carbs_g'   => round($meals->sum('carbs_g'), 1),
            'fat_g'     => round($meals->sum('fat_g'), 1),
            'water_ml'  => (int) $meals->sum('volume_ml'),
        ];

        // A past day keeps its burned side; only the food side can still change (late logging)
        if ($snap && $day->lt($today) && ! $recalculate) {
            $food = $eaten['intake'] > 0 ? (int) round($eaten['intake'] * self::TEF) : $snap->food_kcal;
            $d = [
                'bmr' => $snap->bmr_kcal, 'steps' => $snap->steps_kcal, 'training' => $snap->training_kcal, 'food' => $food,
                'total' => $snap->bmr_kcal + $snap->steps_kcal + $snap->training_kcal + $food,
                'trainings' => $snap->trainings, 'estimated' => $snap->estimated,
            ] + $eaten;
            if ($snap->intake_kcal !== $eaten['intake'] || $snap->food_kcal !== $food) {
                $snap->update(['intake_kcal' => $eaten['intake'], 'food_kcal' => $food, 'total_kcal' => $d['total'],
                    'protein_g' => $eaten['protein_g'], 'carbs_g' => $eaten['carbs_g'], 'fat_g' => $eaten['fat_g'], 'water_ml' => $eaten['water_ml']]);
            }
            return $d;
        }

        $bmrKcal ??= self::bmr($user)['kcal'] ?? null;
        if (! $bmrKcal) {
            return self::emptyDay(0);
        }
        $trainings = Training::where('user_id', $user->id)->where('is_primary', true)
            ->whereBetween('started_at', [$day->copy()->utc(), $day->copy()->endOfDay()->utc()])->get();
        $trainingKcal = 0;
        $estimated = false;
        foreach ($trainings as $t) {
            $e = self::trainingKcal($t, $user);
            $trainingKcal += $e['kcal'];
            $estimated = $estimated || $e['source'] !== 'device';
        }
        $steps = $user->avg_daily_steps ? (int) round($user->avg_daily_steps * self::KCAL_PER_STEP_KG * $user->weight_kg) : 0;
        // Thermic effect of food: ~10 % of what was eaten; without a food log, ~10 % of the burn
        $food = (int) round(($eaten['intake'] > 0 ? $eaten['intake'] : $bmrKcal + $steps + $trainingKcal) * self::TEF);
        $d = [
            'bmr' => $bmrKcal, 'steps' => $steps, 'training' => $trainingKcal, 'food' => $food,
            'total' => $bmrKcal + $steps + $trainingKcal + $food,
            'trainings' => $trainings->count(), 'estimated' => $estimated,
        ] + $eaten;

        HealthDay::updateOrCreate(['user_id' => $user->id, 'day' => $day->toDateString()], [
            'bmr_kcal' => $d['bmr'], 'steps_kcal' => $d['steps'], 'training_kcal' => $d['training'], 'food_kcal' => $d['food'],
            'total_kcal' => $d['total'], 'intake_kcal' => $d['intake'], 'protein_g' => $d['protein_g'], 'carbs_g' => $d['carbs_g'],
            'fat_g' => $d['fat_g'], 'water_ml' => $d['water_ml'], 'trainings' => $d['trainings'], 'weight_kg' => $user->weight_kg,
            'estimated' => $estimated,
        ]);

        return $d;
    }

    private static function emptyDay(int $bmr): array
    {
        return ['bmr' => $bmr, 'steps' => 0, 'training' => 0, 'food' => 0, 'total' => $bmr, 'trainings' => 0, 'estimated' => false,
            'intake' => 0, 'protein_g' => 0, 'carbs_g' => 0, 'fat_g' => 0, 'water_ml' => 0];
    }

    public static function inputs(User $user): array
    {
        return [
            'sex'              => $user->sex,
            'birth_date'       => $user->birth_date?->toDateString(),
            'age'              => $user->birth_date?->age,
            'weight_kg'        => $user->weight_kg,
            'height_cm'        => $user->height_cm,
            'body_fat_pct'     => $user->body_fat_pct,
            'avg_daily_steps'  => $user->avg_daily_steps,
            'ftp_w'            => $user->ftp_w,
            'goal'             => $user->health_goal,
            'target_weight_kg' => $user->target_weight_kg,
        ];
    }

    /** Compact athlete block for the AI coach prompts (no names, nothing that isn't needed). */
    public static function forCoach(?User $user): array
    {
        if (! $user) {
            return [];
        }
        $bmr = self::bmr($user);

        return array_filter([
            'age'             => $user->birth_date?->age,
            'sex'             => in_array($user->sex, ['male', 'female'], true) ? $user->sex : null,
            'skill'           => $user->skill_level,
            'weight_kg'       => $user->weight_kg,
            'height_cm'       => $user->height_cm,
            'body_fat_pct'    => $user->body_fat_pct,
            'bmr_kcal'        => $bmr['kcal'] ?? null,
            'avg_daily_steps' => $user->avg_daily_steps,
            'ftp_w'           => $user->ftp_w,
            'ftp_w_per_kg'    => $user->ftp_w && $user->weight_kg ? round($user->ftp_w / $user->weight_kg, 2) : null,
            'goal'            => $user->health_goal,
            'target_weight_kg'=> $user->target_weight_kg,
        ], fn ($v) => $v !== null && $v !== '');
    }
}
