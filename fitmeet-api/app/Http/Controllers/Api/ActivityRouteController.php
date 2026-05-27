<?php

namespace App\Http\Controllers\Api;

use App\Enums\Category;
use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityRouteResource;
use App\Models\ActivityRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ActivityRouteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityRoute::query()
            ->with('creator')
            ->public();

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('q')) {
            $needle = '%' . $request->string('q')->toString() . '%';
            $query->where(fn ($q) => $q
                ->where('title', 'like', $needle)
                ->orWhere('area_label', 'like', $needle));
        }

        if ($request->filled('distance_min')) {
            $query->where('distance_km', '>=', $request->float('distance_min'));
        }

        if ($request->filled('distance_max')) {
            $query->where('distance_km', '<=', $request->float('distance_max'));
        }

        if ($request->filled('elevation_min')) {
            $query->where('elevation_gain', '>=', $request->integer('elevation_min'));
        }

        if ($request->filled('elevation_max')) {
            $query->where('elevation_gain', '<=', $request->integer('elevation_max'));
        }

        if ($request->filled('lat') && $request->filled('lng') && $request->filled('radius_km')) {
            $lat = $request->float('lat');
            $lng = $request->float('lng');
            $radiusKm = max(1, $request->integer('radius_km'));
            $query
                ->select('routes.*')
                ->selectRaw("(
                    6371 * ACOS(
                        LEAST(1, GREATEST(-1,
                            COS(RADIANS(?)) * COS(RADIANS(start_lat)) *
                            COS(RADIANS(start_lng) - RADIANS(?)) +
                            SIN(RADIANS(?)) * SIN(RADIANS(start_lat))
                        ))
                    )
                ) AS distance_from_user", [$lat, $lng, $lat])
                ->whereNotNull('start_lat')
                ->whereNotNull('start_lng')
                ->having('distance_from_user', '<=', $radiusKm);
        }

        match ($request->string('sort', 'new')->toString()) {
            'distance_asc' => $query->orderBy('distance_km')->orderByDesc('created_at'),
            'distance_desc' => $query->orderByDesc('distance_km')->orderByDesc('created_at'),
            'elevation_asc' => $query->orderBy('elevation_gain')->orderByDesc('created_at'),
            'elevation_desc' => $query->orderByDesc('elevation_gain')->orderByDesc('created_at'),
            'popular' => $query->orderByDesc('views_count')->orderByDesc('created_at'),
            default => $query->orderByDesc('created_at'),
        };

        $perPage = max(10, min(100, (int) $request->integer('per_page', 20)));
        $routes = $query->paginate($perPage);

        return response()->json([
            'data' => ActivityRouteResource::collection($routes->items()),
            'meta' => [
                'current_page' => $routes->currentPage(),
                'last_page' => $routes->lastPage(),
                'total' => $routes->total(),
            ],
        ]);
    }

    public function show(ActivityRoute $activityRoute): JsonResponse
    {
        abort_unless($activityRoute->is_public, 404);

        $activityRoute->increment('views_count');
        $activityRoute->load('creator');

        return response()->json(['data' => new ActivityRouteResource($activityRoute)]);
    }

    public function gpx(ActivityRoute $activityRoute): \Illuminate\Http\Response
    {
        abort_unless($activityRoute->is_public, 404);
        abort_unless($activityRoute->gpx_path && Storage::disk('public')->exists($activityRoute->gpx_path), 404);

        return response(Storage::disk('public')->get($activityRoute->gpx_path), 200, [
            'Content-Type' => 'application/gpx+xml',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
