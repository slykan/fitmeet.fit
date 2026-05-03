<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StravaController
{
    // POST /api/strava/token  { code }
    public function exchangeToken(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $res = Http::asForm()->post('https://www.strava.com/oauth/token', [
            'client_id'     => config('services.strava.client_id'),
            'client_secret' => config('services.strava.client_secret'),
            'code'          => $request->code,
            'grant_type'    => 'authorization_code',
        ]);

        if (!$res->successful()) {
            return response()->json(['message' => 'Strava auth failed.'], 422);
        }

        $data = $res->json();

        return response()->json([
            'access_token' => $data['access_token'],
            'athlete_id'   => $data['athlete']['id'] ?? null,
        ]);
    }
}
