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

        $trainings = $query->paginate(30)->through(fn (Training $t) => [
            'id'             => $t->id,
            'provider'       => $t->provider,
            'category'       => ['value' => $t->category->value, 'label' => $t->category->label()],
            'name'           => $t->name,
            'started_at'     => $t->started_at,
            'duration_s'     => $t->duration_s,
            'distance_m'     => $t->distance_m,
            'elevation_gain' => $t->elevation_gain,
            'is_merged'      => $t->dedup_group_id !== null,
        ]);

        return response()->json($trainings);
    }
}
