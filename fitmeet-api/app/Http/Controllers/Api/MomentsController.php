<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MomentsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $page    = max(1, (int) $request->query('page', 1));
        $perPage = 12;

        $moments = Event::query()
            ->where('is_private', false)
            ->whereNotNull('moment_image_path')
            ->where('start_at', '<', now())
            ->orderByDesc('start_at')
            ->select('id', 'title', 'moment_image_path', 'moment_cover_x', 'moment_cover_y', 'category', 'start_at', 'user_id')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $moments->map(fn ($e) => [
                'id'        => $e->id,
                'title'     => $e->title,
                'image_url' => url('/storage/' . $e->moment_image_path),
                'cover'     => [
                    'x' => $e->moment_cover_x ?? 0.5,
                    'y' => $e->moment_cover_y ?? 0.5,
                ],
                'category'  => $e->category?->value,
                'start_at'  => $e->start_at->toIso8601String(),
            ]),
            'has_more' => $moments->hasMorePages(),
        ]);
    }
}
