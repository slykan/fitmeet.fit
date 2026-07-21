<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Models\ProviderConnection;
use App\Models\User;
use App\Services\TrainingSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
                'id' => isset($route['id']) ? (string) $route['id'] : null,
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

        if ($res->successful() && str_contains(strtolower($res->body()), '<gpx')) {
            return response()->json([
                'gpx' => $res->body(),
            ]);
        }

        if (!$res->successful()) {
            Log::warning('Strava GPX export failed', [
                'user_id' => $request->user()->id,
                'route_id' => $routeId,
                'status' => $res->status(),
                'scope' => $session['scope'] ?? null,
                'body' => Str::limit($res->body(), 1000),
            ]);

        } else {
            Log::warning('Strava GPX export returned non-GPX body', [
                'user_id' => $request->user()->id,
                'route_id' => $routeId,
                'content_type' => $res->header('content-type'),
                'scope' => $session['scope'] ?? null,
                'body' => Str::limit($res->body(), 1000),
            ]);
        }

        $streamGpx = $this->routeStreamsToGpx($session['access_token'], $routeId);
        if ($streamGpx) {
            return response()->json(['gpx' => $streamGpx]);
        }

        $message = $res->status() === 401 || $res->status() === 403
            ? 'Strava did not allow route export. Reconnect Strava and approve route permissions.'
            : 'Could not download GPX for this route.';

        return response()->json(['message' => $message], 422);
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

    // POST /api/strava/connect  { code }  - link Strava for training sync (Connected apps)
    public function connect(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data || empty($data['athlete']['id'])) {
            return response()->json(['message' => 'Strava auth failed.'], 422);
        }

        $user = $request->user();
        $nextPriority = ProviderConnection::where('user_id', $user->id)->max('priority');

        $connection = ProviderConnection::updateOrCreate(
            ['user_id' => $user->id, 'provider' => 'strava'],
            [
                'external_athlete_id' => (string) $data['athlete']['id'],
                'access_token'        => $data['access_token'],
                'refresh_token'       => $data['refresh_token'] ?? null,
                'token_expires_at'    => isset($data['expires_at'])
                    ? Carbon::createFromTimestamp($data['expires_at'])
                    : now()->addHours(6),
                'scope'               => $data['scope'] ?? null,
                'connected_at'        => now(),
                'priority'            => $nextPriority === null ? 0 : $nextPriority + 1,
            ],
        );

        $synced = $this->backfillStrava($connection, $sync);

        return response()->json([
            'connected' => true,
            'synced'    => $synced,
        ]);
    }

    // DELETE /api/strava/connect
    public function disconnect(Request $request): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'strava')
            ->first();

        if (!$connection) {
            return response()->json(['message' => 'Not connected.'], 404);
        }

        if ($connection->access_token) {
            try {
                Http::asForm()->post('https://www.strava.com/oauth/deauthorize', [
                    'access_token' => $connection->access_token,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Strava deauthorize failed', ['user_id' => $request->user()->id, 'error' => $e->getMessage()]);
            }
        }

        $connection->delete();

        return response()->json(['connected' => false]);
    }

    // GET /api/strava/webhook - subscription verification handshake
    public function webhookVerify(Request $request): JsonResponse
    {
        if (
            $request->query('hub_mode') === 'subscribe'
            && $request->query('hub_verify_token') === config('services.strava.webhook_verify_token')
        ) {
            return response()->json(['hub.challenge' => $request->query('hub_challenge')]);
        }

        return response()->json(['message' => 'Verification failed.'], 403);
    }

    // POST /api/strava/webhook - activity create/update/delete events
    public function webhookReceive(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $objectType = $request->input('object_type');
        $aspectType = $request->input('aspect_type');
        $objectId   = $request->input('object_id');
        $ownerId    = $request->input('owner_id');

        if ($objectType !== 'activity' || !$objectId || !$ownerId) {
            return response()->json(['message' => 'Ignored.']);
        }

        $connection = ProviderConnection::where('provider', 'strava')
            ->where('external_athlete_id', (string) $ownerId)
            ->first();

        if (!$connection) {
            return response()->json(['message' => 'Ignored.']);
        }

        if ($aspectType === 'delete') {
            $sync->deleteStravaActivity((string) $objectId);
            return response()->json(['message' => 'Deleted.']);
        }

        $accessToken = $this->ensureFreshToken($connection);
        if (!$accessToken) {
            return response()->json(['message' => 'Token refresh failed.']);
        }

        $res = Http::withToken($accessToken)->get("https://www.strava.com/api/v3/activities/{$objectId}");
        if ($res->successful()) {
            $sync->storeStravaActivity($connection->user, $res->json());
            $connection->update(['last_synced_at' => now()]);
        }

        return response()->json(['message' => 'Processed.']);
    }

    private function backfillStrava(ProviderConnection $connection, TrainingSyncService $sync): int
    {
        $res = Http::withToken($connection->access_token)
            ->get('https://www.strava.com/api/v3/athlete/activities', ['per_page' => 30]);

        if (!$res->successful()) {
            return 0;
        }

        $count = 0;
        foreach ($res->json() ?? [] as $activity) {
            // The summary list is missing calories/description/gear/relative effort —
            // fetch the full detail per activity so backfilled trainings aren't sparse.
            $detail = Http::withToken($connection->access_token)
                ->get("https://www.strava.com/api/v3/activities/{$activity['id']}");
            $payload = $detail->successful() ? $detail->json() : $activity;

            if ($sync->storeStravaActivity($connection->user, $payload)) {
                $count++;
            }
        }

        $connection->update(['last_synced_at' => now()]);

        return $count;
    }

    private function ensureFreshToken(ProviderConnection $connection): ?string
    {
        if ($connection->token_expires_at && $connection->token_expires_at->isFuture()) {
            return $connection->access_token;
        }

        $res = Http::asForm()->post('https://www.strava.com/oauth/token', [
            'client_id'     => config('services.strava.client_id'),
            'client_secret' => config('services.strava.client_secret'),
            'grant_type'    => 'refresh_token',
            'refresh_token' => $connection->refresh_token,
        ]);

        if (!$res->successful()) {
            return null;
        }

        $data = $res->json();
        $connection->update([
            'access_token'     => $data['access_token'],
            'refresh_token'    => $data['refresh_token'] ?? $connection->refresh_token,
            'token_expires_at' => isset($data['expires_at'])
                ? Carbon::createFromTimestamp($data['expires_at'])
                : now()->addHours(6),
        ]);

        return $data['access_token'];
    }

    private function routeStreamsToGpx(string $accessToken, string $routeId): ?string
    {
        $res = Http::withToken($accessToken)
            ->acceptJson()
            ->get("https://www.strava.com/api/v3/routes/{$routeId}/streams");

        if (!$res->successful()) {
            Log::warning('Strava route streams failed', [
                'route_id' => $routeId,
                'status' => $res->status(),
                'body' => Str::limit($res->body(), 1000),
            ]);

            return null;
        }

        $streams = collect($res->json() ?? [])->keyBy('type');
        $latlng = $streams->get('latlng')['data'] ?? null;
        if (!is_array($latlng) || count($latlng) < 2) {
            Log::warning('Strava route streams missing latlng data', [
                'route_id' => $routeId,
                'body' => Str::limit($res->body(), 1000),
            ]);

            return null;
        }

        $altitude = $streams->get('altitude')['data'] ?? [];
        $name = htmlspecialchars("Strava route {$routeId}", ENT_XML1 | ENT_COMPAT, 'UTF-8');
        $points = collect($latlng)->map(function ($point, int $index) use ($altitude) {
            if (!is_array($point) || count($point) < 2) {
                return null;
            }

            $lat = (float) $point[0];
            $lng = (float) $point[1];
            $ele = is_array($altitude) && isset($altitude[$index])
                ? '<ele>' . htmlspecialchars((string) (float) $altitude[$index], ENT_XML1 | ENT_COMPAT, 'UTF-8') . '</ele>'
                : '';

            return sprintf('<trkpt lat="%.7F" lon="%.7F">%s</trkpt>', $lat, $lng, $ele);
        })->filter()->implode('');

        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<gpx version="1.1" creator="FitMeet" xmlns="http://www.topografix.com/GPX/1/1">'
            . "<trk><name>{$name}</name><trkseg>{$points}</trkseg></trk>"
            . '</gpx>';
    }
}
