<?php

namespace App\Services;

use App\Models\Training;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

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
     * Everything the Health screen and the AI coach need.
     * today = calendar day in the app timezone; week = average day of the last 7 days (today included).
     */
    public static function summary(User $user, ?Carbon $now = null): array
    {
        $tz = config('app.timezone');
        $now = ($now ?? now($tz))->copy()->tz($tz);
        $bmr = self::bmr($user);
        $missing = self::missing($user);

        $base = [
            'complete' => ! $missing,
            'missing'  => $missing,
            'profile'  => self::inputs($user),
            'updated_at' => $user->health_updated_at?->toIso8601String(),
        ];
        if (! $bmr) {
            return $base + ['bmr' => null, 'today' => null, 'week' => null];
        }

        $from = $now->copy()->subDays(6)->startOfDay();
        $trainings = Training::where('user_id', $user->id)->where('is_primary', true)
            ->whereBetween('started_at', [$from, $now->copy()->endOfDay()])->get();

        $steps = $user->avg_daily_steps;
        $stepsKcal = $steps ? (int) round($steps * self::KCAL_PER_STEP_KG * $user->weight_kg) : 0;

        $day = function (Collection $list) use ($bmr, $stepsKcal, $user) {
            $kcal = 0;
            $estimated = false;
            foreach ($list as $t) {
                $e = self::trainingKcal($t, $user);
                $kcal += $e['kcal'];
                $estimated = $estimated || $e['source'] !== 'device';
            }
            $tef = (int) round(($bmr['kcal'] + $stepsKcal + $kcal) * self::TEF);
            return [
                'bmr'       => $bmr['kcal'],
                'steps'     => $stepsKcal,
                'training'  => $kcal,
                'food'      => $tef,
                'total'     => $bmr['kcal'] + $stepsKcal + $kcal + $tef,
                'trainings' => $list->count(),
                'estimated' => $estimated,
            ];
        };

        $today = $day($trainings->filter(fn (Training $t) => $t->started_at->copy()->tz($tz)->isSameDay($now)));
        $week = $day($trainings);
        // 7-day average: training kcal and count spread over 7 days, BMR/steps are per day already
        $week['training'] = (int) round($week['training'] / 7);
        $week['trainings'] = round($week['trainings'] / 7, 1);
        $week['food'] = (int) round(($bmr['kcal'] + $stepsKcal + $week['training']) * self::TEF);
        $week['total'] = $bmr['kcal'] + $stepsKcal + $week['training'] + $week['food'];

        return $base + [
            'bmr'   => $bmr,
            'today' => $today,
            'week'  => $week,
            'w_per_kg' => $user->ftp_w ? round($user->ftp_w / $user->weight_kg, 2) : null,
        ];
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
