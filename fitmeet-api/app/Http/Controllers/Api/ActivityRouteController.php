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

    public function my(Request $request): JsonResponse
    {
        $routes = ActivityRoute::query()
            ->with('creator')
            ->where('user_id', auth()->id())
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => ActivityRouteResource::collection($routes)]);
    }

    public function show(ActivityRoute $activityRoute): JsonResponse
    {
        $isOwner = auth()->check() && auth()->id() === $activityRoute->user_id;
        abort_unless($activityRoute->is_public || $isOwner, 404);

        $activityRoute->increment('views_count');
        $activityRoute->load('creator');

        return response()->json(['data' => new ActivityRouteResource($activityRoute)]);
    }

    public function gpx(ActivityRoute $activityRoute): \Illuminate\Http\Response
    {
        $isOwner = auth()->check() && auth()->id() === $activityRoute->user_id;
        abort_unless($activityRoute->is_public || $isOwner, 404);
        abort_unless($activityRoute->gpx_path && Storage::disk('public')->exists($activityRoute->gpx_path), 404);

        return response(Storage::disk('public')->get($activityRoute->gpx_path), 200, [
            'Content-Type' => 'application/gpx+xml',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'          => 'required|string|max:140',
            'category'       => 'required|string|in:' . implode(',', Category::values()),
            'is_public'      => 'boolean',
            'waypoints'      => 'nullable|string',
            'gpx'            => 'required|file|max:20480',
            'distance_km'    => 'nullable|numeric|min:0',
            'elevation_gain' => 'nullable|integer|min:0',
            'max_grade'      => 'nullable|numeric',
            'max_downgrade'  => 'nullable|numeric',
            'start_lat'      => 'nullable|numeric|between:-90,90',
            'start_lng'      => 'nullable|numeric|between:-180,180',
            'end_lat'        => 'nullable|numeric|between:-90,90',
            'end_lng'        => 'nullable|numeric|between:-180,180',
            'area_label'     => 'nullable|string|max:255',
        ]);

        $path = $request->file('gpx')->store('gpx/routes', 'public');

        $route = ActivityRoute::create([
            'user_id'        => auth()->id(),
            'title'          => $data['title'],
            'category'       => $data['category'],
            'is_public'      => $data['is_public'] ?? true,
            'waypoints'      => isset($data['waypoints']) ? json_decode($data['waypoints'], true) : null,
            'gpx_path'       => $path,
            'distance_km'    => $data['distance_km'] ?? null,
            'elevation_gain' => $data['elevation_gain'] ?? null,
            'max_grade'      => $data['max_grade'] ?? null,
            'max_downgrade'  => $data['max_downgrade'] ?? null,
            'start_lat'      => $data['start_lat'] ?? null,
            'start_lng'      => $data['start_lng'] ?? null,
            'end_lat'        => $data['end_lat'] ?? null,
            'end_lng'        => $data['end_lng'] ?? null,
            'area_label'     => $data['area_label'] ?? null,
        ]);

        $route->load('creator');

        return response()->json(['data' => new ActivityRouteResource($route)], 201);
    }

    public function update(Request $request, ActivityRoute $activityRoute): JsonResponse
    {
        abort_unless(auth()->id() === $activityRoute->user_id, 403);

        $data = $request->validate([
            'title'          => 'required|string|max:140',
            'category'       => 'required|string|in:' . implode(',', Category::values()),
            'is_public'      => 'boolean',
            'waypoints'      => 'nullable|string',
            'gpx'            => 'nullable|file|max:20480',
            'distance_km'    => 'nullable|numeric|min:0',
            'elevation_gain' => 'nullable|integer|min:0',
            'max_grade'      => 'nullable|numeric',
            'max_downgrade'  => 'nullable|numeric',
            'start_lat'      => 'nullable|numeric|between:-90,90',
            'start_lng'      => 'nullable|numeric|between:-180,180',
            'end_lat'        => 'nullable|numeric|between:-90,90',
            'end_lng'        => 'nullable|numeric|between:-180,180',
            'area_label'     => 'nullable|string|max:255',
        ]);

        $updates = [
            'title'          => $data['title'],
            'category'       => $data['category'],
            'is_public'      => $data['is_public'] ?? $activityRoute->is_public,
            'waypoints'      => isset($data['waypoints']) ? json_decode($data['waypoints'], true) : $activityRoute->waypoints,
            'distance_km'    => $data['distance_km'] ?? $activityRoute->distance_km,
            'elevation_gain' => $data['elevation_gain'] ?? $activityRoute->elevation_gain,
            'max_grade'      => $data['max_grade'] ?? $activityRoute->max_grade,
            'max_downgrade'  => $data['max_downgrade'] ?? $activityRoute->max_downgrade,
            'start_lat'      => $data['start_lat'] ?? $activityRoute->start_lat,
            'start_lng'      => $data['start_lng'] ?? $activityRoute->start_lng,
            'end_lat'        => $data['end_lat'] ?? $activityRoute->end_lat,
            'end_lng'        => $data['end_lng'] ?? $activityRoute->end_lng,
            'area_label'     => $data['area_label'] ?? $activityRoute->area_label,
        ];

        if ($request->hasFile('gpx')) {
            if ($activityRoute->gpx_path && Storage::disk('public')->exists($activityRoute->gpx_path)) {
                Storage::disk('public')->delete($activityRoute->gpx_path);
            }
            $updates['gpx_path'] = $request->file('gpx')->store('gpx/routes', 'public');
        }

        $activityRoute->update($updates);
        $activityRoute->load('creator');

        return response()->json(['data' => new ActivityRouteResource($activityRoute)]);
    }

    public function destroy(ActivityRoute $activityRoute): JsonResponse
    {
        abort_unless(auth()->id() === $activityRoute->user_id, 403);

        if ($activityRoute->gpx_path && Storage::disk('public')->exists($activityRoute->gpx_path)) {
            Storage::disk('public')->delete($activityRoute->gpx_path);
        }

        $activityRoute->delete();

        return response()->json(['message' => 'Route deleted.']);
    }
}
