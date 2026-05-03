<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StravaController
{
    private function exchangeCode(string $code): ?array
    {
        $res = Http::asForm()->post('https://www.strava.com/oauth/token', [
            'client_id'     => config('services.strava.client_id'),
            'client_secret' => config('services.strava.client_secret'),
            'code'          => $code,
            'grant_type'    => 'authorization_code',
        ]);
        return $res->successful() ? $res->json() : null;
    }

    // POST /api/strava/token  { code }  — route import
    public function exchangeToken(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data) return response()->json(['message' => 'Strava auth failed.'], 422);

        return response()->json([
            'access_token' => $data['access_token'],
            'athlete_id'   => $data['athlete']['id'] ?? null,
        ]);
    }

    // POST /api/strava/login  { code }  — sign in with Strava
    public function login(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data) return response()->json(['message' => 'Strava auth failed.'], 422);

        $athlete  = $data['athlete'];
        $stravaId = (string) $athlete['id'];
        $name     = trim(($athlete['firstname'] ?? '') . ' ' . ($athlete['lastname'] ?? '')) ?: 'Strava User';
        $avatar   = $athlete['profile'] ?? null;

        $user = User::where('strava_id', $stravaId)->first()
            ?? User::create([
                'strava_id' => $stravaId,
                'name'      => $name,
                'email'     => "strava_{$stravaId}@fitmeet.fit",
                'password'  => bcrypt(str()->random(32)),
                'avatar'    => $avatar,
            ]);

        // Update avatar if changed
        if ($avatar && $user->avatar !== $avatar) {
            $user->update(['avatar' => $avatar]);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => new UserResource($user),
        ]);
    }
}
