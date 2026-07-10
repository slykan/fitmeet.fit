<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BadgeController extends Controller
{
    // GET /api/badges — full catalog + current user's unlocked state
    public function index(Request $request, BadgeService $badgeService): JsonResponse
    {
        return response()->json([
            'data' => $badgeService->catalogFor($request->user()),
        ]);
    }
}
