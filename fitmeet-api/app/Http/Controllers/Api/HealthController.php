<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WeightLog;
use App\Services\HealthProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Health (own profile only): inputs for BMR / daily energy and the computed summary.
 * birth_date is the same field as in the profile; weigh-ins are kept per day in weight_logs.
 */
class HealthController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(HealthProfile::summary($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sex'              => ['required', Rule::in(['male', 'female', 'na'])],
            'birth_date'       => ['required', 'date', 'before:-10 years', 'after:1900-01-01'],
            'weight_kg'        => ['required', 'numeric', 'between:25,350'],
            'height_cm'        => ['required', 'integer', 'between:100,250'],
            'body_fat_pct'     => ['nullable', 'numeric', 'between:3,70'],
            'avg_daily_steps'  => ['nullable', 'integer', 'between:0,60000'],
            'ftp_w'            => ['nullable', 'integer', 'between:50,700'],
            'goal'             => ['nullable', Rule::in(['lose', 'maintain', 'gain'])],
            'target_weight_kg' => ['nullable', 'numeric', 'between:25,350'],
        ]);

        $user = $request->user();
        $weightChanged = (float) $user->weight_kg !== (float) $data['weight_kg']
            || (float) $user->body_fat_pct !== (float) ($data['body_fat_pct'] ?? 0);

        $user->update([
            'sex'              => $data['sex'],
            'birth_date'       => $data['birth_date'],
            'weight_kg'        => round((float) $data['weight_kg'], 1),
            'height_cm'        => (int) $data['height_cm'],
            'body_fat_pct'     => isset($data['body_fat_pct']) ? round((float) $data['body_fat_pct'], 1) : null,
            'avg_daily_steps'  => $data['avg_daily_steps'] ?? null,
            'ftp_w'            => $data['ftp_w'] ?? null,
            'health_goal'      => $data['goal'] ?? null,
            'target_weight_kg' => isset($data['target_weight_kg']) ? round((float) $data['target_weight_kg'], 1) : null,
            'health_updated_at'=> now(),
        ]);

        if ($weightChanged) {
            WeightLog::updateOrCreate(
                ['user_id' => $user->id, 'measured_on' => now(config('app.timezone'))->toDateString()],
                ['weight_kg' => $user->weight_kg, 'body_fat_pct' => $user->body_fat_pct],
            );
        }

        return response()->json(HealthProfile::summary($user->fresh()));
    }
}
