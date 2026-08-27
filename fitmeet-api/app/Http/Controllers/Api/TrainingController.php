<?php

namespace App\Http\Controllers\Api;

use App\Models\Training;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrainingController
{
    // GET /api/trainings
    public function index(Request $request): JsonResponse
    {
        $query = Training::where('user_id', $request->user()->id)
            ->where('is_primary', true);

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('year')) {
            $query->whereYear('started_at', $request->integer('year'));
        }

        if ($request->filled('month')) {
            $query->whereMonth('started_at', $request->integer('month'));
        }

        // Aggregate over the full filtered set (not just the current page).
        $totals = (clone $query)->selectRaw('
            COUNT(*) as count,
            COALESCE(SUM(distance_m), 0) as distance_m,
            COALESCE(SUM(duration_s), 0) as duration_s,
            COALESCE(SUM(elevation_gain), 0) as elevation_gain,
            COALESCE(SUM(calories), 0) as calories
        ')->first();

        $perPage = max(10, min(100, (int) $request->integer('per_page', 20)));

        $trainings = $query->orderByDesc('started_at')->paginate($perPage)->through(fn (Training $t) => [
            'id'             => $t->id,
            'provider'       => $t->provider,
            'category'       => ['value' => $t->category->value, 'label' => $t->category->label()],
            'name'           => $t->name,
            'started_at'     => $t->started_at,
            'duration_s'     => $t->duration_s,
            'distance_m'     => $t->distance_m,
            'elevation_gain' => $t->elevation_gain,
            'avg_heartrate'  => $t->avg_heartrate,
            'max_heartrate'  => $t->max_heartrate,
            'avg_watts'      => $t->avg_watts,
            'max_watts'      => $t->max_watts,
            'avg_cadence'    => $t->avg_cadence,
            'calories'       => $t->calories,
            'avg_speed_mps'  => $t->avg_speed_mps,
            'max_speed_mps'  => $t->max_speed_mps,
            'kilojoules'     => $t->kilojoules,
            'suffer_score'   => $t->suffer_score,
            'gear_name'      => $t->gear_name,
            'description'    => $t->description,
            'is_merged'      => $t->dedup_group_id !== null,
        ]);

        return response()->json([
            'data' => $trainings->items(),
            'meta' => [
                'current_page' => $trainings->currentPage(),
                'last_page'    => $trainings->lastPage(),
                'total'        => $trainings->total(),
            ],
            'totals' => [
                'count'          => (int) $totals->count,
                'distance_m'     => (float) $totals->distance_m,
                'duration_s'     => (int) $totals->duration_s,
                'elevation_gain' => (float) $totals->elevation_gain,
                'calories'       => (float) $totals->calories,
            ],
        ]);
    }
}
