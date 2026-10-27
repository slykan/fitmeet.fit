<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meal;
use App\Models\SavedMeal;
use App\Services\HealthProfile;
use App\Services\MealEstimator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Health › Food (own data only). Estimating costs one AI call (monthly allowance);
 * saving, "repeat" and the quick drink buttons don't.
 */
class MealController extends Controller
{
    // Quick-add drinks — no AI needed (kcal, protein, carbs, fat per serving)
    public const QUICK_DRINKS = [
        ['key' => 'water',  'label' => 'Water 0.5 l',        'kcal' => 0,   'protein_g' => 0,   'carbs_g' => 0,  'fat_g' => 0,   'volume_ml' => 500],
        ['key' => 'coffee', 'label' => 'Espresso',           'kcal' => 2,   'protein_g' => 0.1, 'carbs_g' => 0,  'fat_g' => 0,   'volume_ml' => 30],
        ['key' => 'latte',  'label' => 'Coffee with milk',   'kcal' => 40,  'protein_g' => 2,   'carbs_g' => 3,  'fat_g' => 2,   'volume_ml' => 150],
        ['key' => 'beer',   'label' => 'Beer 0.5 l',         'kcal' => 215, 'protein_g' => 2.5, 'carbs_g' => 18, 'fat_g' => 0,   'volume_ml' => 500],
        ['key' => 'wine',   'label' => 'Wine 2 dl',          'kcal' => 165, 'protein_g' => 0.1, 'carbs_g' => 5,  'fat_g' => 0,   'volume_ml' => 200],
        ['key' => 'juice',  'label' => 'Juice 2.5 dl',       'kcal' => 112, 'protein_g' => 1,   'carbs_g' => 26, 'fat_g' => 0.3, 'volume_ml' => 250],
        ['key' => 'cola',   'label' => 'Cola 0.33 l',        'kcal' => 139, 'protein_g' => 0,   'carbs_g' => 35, 'fat_g' => 0,   'volume_ml' => 330],
        ['key' => 'iso',    'label' => 'Sports drink 0.5 l', 'kcal' => 120, 'protein_g' => 0,   'carbs_g' => 30, 'fat_g' => 0,   'volume_ml' => 500],
    ];

    public function estimate(Request $request, MealEstimator $estimator): JsonResponse
    {
        $data = $request->validate([
            'description' => ['required', 'string', 'min:2', 'max:500'],
            'language'    => ['nullable', 'string', 'max:12'],
        ]);
        if (! filled(config('services.anthropic.api_key'))) {
            return response()->json(['message' => 'Food estimates are not available right now.'], 503);
        }
        if (self::estimatesLeft($request) <= 0) {
            return response()->json(['message' => 'You have used this month\'s food estimates. You can still repeat earlier meals or enter calories by hand.'], 429);
        }

        try {
            $e = $estimator->estimate($data['description'], $data['language'] ?? 'en');
        } catch (\Throwable $ex) {
            report($ex);
            return response()->json(['message' => 'Could not estimate this meal right now. Try again or enter calories by hand.'], 502);
        }
        DB::table('coach_requests')->insert([
            'user_id' => $request->user()->id, 'training_id' => null, 'kind' => 'meal',
            'input_tokens' => $e['usage']['input_tokens'], 'output_tokens' => $e['usage']['output_tokens'], 'created_at' => now(),
        ]);
        unset($e['usage']);

        return response()->json($e + ['estimates_left' => self::estimatesLeft($request)]);
    }

    public function store(Request $request): JsonResponse
    {
        $tz = HealthProfile::tz();
        $data = $request->validate([
            'date'               => ['nullable', 'date_format:Y-m-d', 'before_or_equal:' . now($tz)->toDateString(), 'after:' . now($tz)->subYear()->toDateString()],
            'description'        => ['required', 'string', 'max:500'],
            'kind'               => ['nullable', Rule::in(['meal', 'drink'])],
            'source'             => ['nullable', Rule::in(['ai', 'repeat', 'quick', 'manual', 'saved'])],
            'save'               => ['nullable', 'boolean'],                 // also store under "My meals"
            'saved_meal_id'      => ['nullable', 'integer'],                 // logged from "My meals"
            'kcal'               => ['required', 'integer', 'between:0,6000'],
            'protein_g'          => ['nullable', 'numeric', 'between:0,500'],
            'carbs_g'            => ['nullable', 'numeric', 'between:0,1000'],
            'fat_g'              => ['nullable', 'numeric', 'between:0,500'],
            'volume_ml'          => ['nullable', 'integer', 'between:0,5000'],
            'items'              => ['nullable', 'array', 'max:20'],
            'items.*.name'       => ['required_with:items', 'string', 'max:120'],
            'items.*.kcal'       => ['required_with:items', 'numeric', 'between:0,6000'],
            'items.*.protein_g'  => ['nullable', 'numeric'],
            'items.*.carbs_g'    => ['nullable', 'numeric'],
            'items.*.fat_g'      => ['nullable', 'numeric'],
        ]);
        $date = isset($data['date']) ? Carbon::parse($data['date'], $tz) : now($tz);
        $at = $date->isSameDay(now($tz)) ? now($tz) : $date->copy()->setTime(12, 0);

        Meal::create([
            'user_id'     => $request->user()->id,
            'eaten_on'    => $date->toDateString(),
            'eaten_at'    => $at->copy()->utc(),
            'kind'        => $data['kind'] ?? 'meal',
            'description' => trim($data['description']),
            'items'       => $data['items'] ?? null,
            'kcal'        => $data['kcal'],
            'protein_g'   => round((float) ($data['protein_g'] ?? 0), 1),
            'carbs_g'     => round((float) ($data['carbs_g'] ?? 0), 1),
            'fat_g'       => round((float) ($data['fat_g'] ?? 0), 1),
            'volume_ml'   => $data['volume_ml'] ?? null,
            'source'      => $data['source'] ?? 'manual',
        ]);

        $user = $request->user();
        if (! empty($data['saved_meal_id'])) {
            SavedMeal::where('user_id', $user->id)->whereKey($data['saved_meal_id'])
                ->update(['uses' => DB::raw('uses + 1'), 'last_used_at' => now()]);
        }
        if (! empty($data['save'])) {
            // same description (ignoring case) updates the saved meal instead of adding a duplicate
            $description = trim($data['description']);
            $saved = SavedMeal::where('user_id', $user->id)->whereRaw('LOWER(description) = ?', [mb_strtolower($description)])->first()
                ?? new SavedMeal(['user_id' => $user->id]);
            $saved->fill([
                'kind' => $data['kind'] ?? 'meal', 'description' => $description, 'items' => $data['items'] ?? null,
                'kcal' => $data['kcal'], 'protein_g' => round((float) ($data['protein_g'] ?? 0), 1),
                'carbs_g' => round((float) ($data['carbs_g'] ?? 0), 1), 'fat_g' => round((float) ($data['fat_g'] ?? 0), 1),
                'volume_ml' => $data['volume_ml'] ?? null, 'uses' => ($saved->uses ?? 0) + 1, 'last_used_at' => now(),
            ])->save();
        }

        return response()->json(self::payload($request, $date));
    }

    /** Remove a meal from "My meals" (the logged meals stay). ?date= keeps the client on the day it shows. */
    public function destroySaved(Request $request, SavedMeal $savedMeal): JsonResponse
    {
        abort_unless($savedMeal->user_id === $request->user()->id, 404);
        $savedMeal->delete();
        $date = $request->query('date');

        return response()->json(self::payload($request, $date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? Carbon::parse($date, HealthProfile::tz()) : null));
    }

    public function destroy(Request $request, Meal $meal): JsonResponse
    {
        abort_unless($meal->user_id === $request->user()->id, 404);
        $date = Carbon::parse($meal->eaten_on->toDateString(), HealthProfile::tz());
        $meal->delete();

        return response()->json(self::payload($request, $date));
    }

    /** Health summary for one day + that day's food, recent meals to repeat, quick drinks, allowance. */
    public static function payload(Request $request, ?Carbon $date = null): array
    {
        $user = $request->user();
        $tz = HealthProfile::tz();
        $date = ($date ?? now($tz))->copy()->tz($tz)->startOfDay();
        $summary = HealthProfile::summary($user, $date);

        $meals = Meal::where('user_id', $user->id)->whereDate('eaten_on', $date->toDateString())->orderBy('eaten_at')->get()
            ->map(fn (Meal $m) => [
                'id' => $m->id, 'kind' => $m->kind, 'description' => $m->description, 'items' => $m->items ?? [],
                'kcal' => $m->kcal, 'protein_g' => $m->protein_g, 'carbs_g' => $m->carbs_g, 'fat_g' => $m->fat_g,
                'volume_ml' => $m->volume_ml, 'source' => $m->source, 'time' => $m->eaten_at->copy()->tz($tz)->format('H:i'),
            ])->values();

        // Recent meals to repeat with one tap: latest of each distinct description (no quick drinks)
        $recent = Meal::where('user_id', $user->id)->where('source', '!=', 'quick')
            ->where('eaten_on', '>=', now($tz)->subDays(60)->toDateString())
            ->orderByDesc('eaten_at')->limit(200)->get()
            ->unique(fn (Meal $m) => mb_strtolower(trim($m->description)))->take(12)
            ->map(fn (Meal $m) => [
                'description' => $m->description, 'kind' => $m->kind, 'items' => $m->items ?? [], 'kcal' => $m->kcal,
                'protein_g' => $m->protein_g, 'carbs_g' => $m->carbs_g, 'fat_g' => $m->fat_g, 'volume_ml' => $m->volume_ml,
            ])->values();

        // "My meals": most used first
        $saved = SavedMeal::where('user_id', $user->id)->orderByDesc('uses')->orderByDesc('last_used_at')->limit(50)->get()
            ->map(fn (SavedMeal $s) => [
                'id' => $s->id, 'description' => $s->description, 'kind' => $s->kind, 'items' => $s->items ?? [], 'kcal' => $s->kcal,
                'protein_g' => $s->protein_g, 'carbs_g' => $s->carbs_g, 'fat_g' => $s->fat_g, 'volume_ml' => $s->volume_ml,
            ])->values();

        return $summary + [
            'meals'          => $meals,
            'recent'         => $recent,
            'saved'          => $saved,
            'quick_drinks'   => self::QUICK_DRINKS,
            'estimates_left' => self::estimatesLeft($request),
        ];
    }

    public static function estimatesLeft(Request $request): int
    {
        if ($request->user()->is_admin) {
            return 999;
        }
        $used = DB::table('coach_requests')->where('user_id', $request->user()->id)->where('kind', 'meal')
            ->where('created_at', '>=', now()->startOfMonth())->count();

        return max(0, (int) config('services.anthropic.meal_monthly_estimates') - $used);
    }
}
