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
            ->where('is_primary', true)
            ->orderByDesc('started_at');

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('year')) {
            $query->whereYear('started_at', $request->integer('year'));
        }

        if ($request->filled('month')) {
            $query->whereMonth('started_at', $request->integer('month'));
        }

        $trainings = $query->paginate(30)->through(fn (Training $t) => [
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

        return response()->json($trainings);
    }
}
