<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

    // POST /api/strava/token  { code }  - legacy route import
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

    // POST /api/strava/routes  { code }  - route import
    public function routes(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data) return response()->json(['message' => 'Strava auth failed.'], 422);

        $accessToken = $data['access_token'] ?? null;
        $athleteId = $data['athlete']['id'] ?? null;
        if (!$accessToken || !$athleteId) {
            return response()->json(['message' => 'Strava auth failed.'], 422);
        }

        $res = Http::withToken($accessToken)
            ->get("https://www.strava.com/api/v3/athletes/{$athleteId}/routes", [
                'per_page' => 50,
            ]);

        if (!$res->successful()) {
            return response()->json(['message' => 'Could not fetch Strava routes.'], 422);
        }

        $importToken = (string) Str::uuid();
        Cache::put("strava_import:{$request->user()->id}:{$importToken}", [
            'access_token' => $accessToken,
            'athlete_id' => $athleteId,
            'scope' => $data['scope'] ?? null,
        ], now()->addMinutes(15));

        return response()->json([
            'import_token' => $importToken,
            'data' => collect($res->json() ?? [])->map(fn ($route) => [
                'id' => $route['id'] ?? null,
                'name' => $route['name'] ?? 'Strava route',
                'distance' => $route['distance'] ?? 0,
                'elevation_gain' => $route['elevation_gain'] ?? 0,
                'type' => $route['type'] ?? null,
                'sub_type' => $route['sub_type'] ?? null,
            ])->filter(fn ($route) => filled($route['id']))->values(),
        ]);
    }

    // POST /api/strava/routes/{routeId}/gpx  { import_token }
    public function routeGpx(Request $request, string $routeId): JsonResponse
    {
        $request->validate(['import_token' => 'required|string']);

        $cacheKey = "strava_import:{$request->user()->id}:{$request->import_token}";
        $session = Cache::get($cacheKey);
        if (!$session || empty($session['access_token'])) {
            return response()->json(['message' => 'Strava session expired. Connect again.'], 422);
        }

        $res = Http::withToken($session['access_token'])
            ->accept('application/gpx+xml')
            ->get("https://www.strava.com/api/v3/routes/{$routeId}/export_gpx");

        if (!$res->successful()) {
            Log::warning('Strava GPX export failed', [
                'user_id' => $request->user()->id,
                'route_id' => $routeId,
                'status' => $res->status(),
                'scope' => $session['scope'] ?? null,
                'body' => Str::limit($res->body(), 1000),
            ]);

            $message = $res->status() === 401 || $res->status() === 403
                ? 'Strava did not allow GPX export for this route. Reconnect Strava and approve route permissions.'
                : 'Could not download GPX for this route.';

            return response()->json(['message' => $message], 422);
        }

        return response()->json([
            'gpx' => $res->body(),
        ]);
    }

    // POST /api/strava/login  { code }  - sign in with Strava
    public function login(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data) return response()->json(['message' => 'Strava auth failed.'], 422);

        $athlete  = $data['athlete'];
        $stravaId = (string) $athlete['id'];
        $name     = trim(($athlete['firstname'] ?? '') . ' ' . ($athlete['lastname'] ?? '')) ?: 'Strava User';
        $avatar   = $athlete['profile'] ?? null;

        $user = User::where('strava_id', $stravaId)->first();

        if (!$user) {
            $user = User::create([
                'strava_id' => $stravaId,
                'name'      => $name,
                'email'     => "strava_{$stravaId}@fitmeet.fit",
                'password'  => bcrypt(str()->random(32)),
                'avatar'    => $avatar,
            ]);
        } else {
            $updates = ['strava_id' => $stravaId];
            if (empty($user->avatar) && $avatar) {
                $updates['avatar'] = $avatar;
            }
            if ($name && $user->name === 'Strava User') {
                $updates['name'] = $name;
            }
            $user->update($updates);
        }

        $token = $user->createToken('fitmeet-mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ]);
    }
}
