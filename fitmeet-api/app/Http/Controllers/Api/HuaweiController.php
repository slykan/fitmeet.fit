<?php

namespace App\Http\Controllers\Api;

use App\Models\ProviderConnection;
use App\Services\TrainingSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class HuaweiController
{
    private function exchangeCode(string $code): ?array
    {
        $res = Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/token', [
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'client_id'     => config('services.huawei.client_id'),
            'client_secret' => config('services.huawei.client_secret'),
            'redirect_uri'  => config('services.huawei.redirect_uri'),
        ]);

        return $res->successful() ? $res->json() : null;
    }

    // Huawei's token response carries the user's identity in the id_token (a JWT) rather
    // than as a plain field — decode its payload (no signature check needed, it came
    // straight from Huawei's own token endpoint over TLS) and fall back to openID/unionID
    // in case a given response shape includes those directly instead.
    private function extractOpenId(array $tokenData): ?string
    {
        if (!empty($tokenData['id_token'])) {
            $parts = explode('.', $tokenData['id_token']);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                if (!empty($payload['sub'])) {
                    return (string) $payload['sub'];
                }
            }
        }

        return $tokenData['openID'] ?? $tokenData['unionID'] ?? null;
    }

    // POST /api/huawei/connect  { code }  - Connected Apps linking
    public function connect(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $data = $this->exchangeCode($request->code);
        if (!$data || empty($data['access_token'])) {
            return response()->json(['message' => 'Huawei auth failed.'], 422);
        }

        $athleteId = $this->extractOpenId($data);
        if (!$athleteId) {
            return response()->json(['message' => 'Huawei auth failed.'], 422);
        }

        $user = $request->user();
        $nextPriority = ProviderConnection::where('user_id', $user->id)->max('priority');

        $connection = ProviderConnection::updateOrCreate(
            ['user_id' => $user->id, 'provider' => 'huawei'],
            [
                'external_athlete_id' => $athleteId,
                'access_token'        => $data['access_token'],
                'refresh_token'       => $data['refresh_token'] ?? null,
                'token_expires_at'    => isset($data['expires_in'])
                    ? now()->addSeconds((int) $data['expires_in'])
                    : now()->addHour(),
                'scope'               => $data['scope'] ?? null,
                'connected_at'        => now(),
                'priority'            => $nextPriority === null ? 0 : $nextPriority + 1,
            ],
        );

        $synced = $this->backfillHuawei($connection, $sync);

        return response()->json(['connected' => true, 'synced' => $synced]);
    }

    // DELETE /api/huawei/connect
    public function disconnect(Request $request): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'huawei')
            ->first();

        if ($connection) {
            try {
                Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/revoke', [
                    'token' => $connection->access_token,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Huawei token revoke failed', ['exception' => $e->getMessage()]);
            }

            $connection->delete();
        }

        return response()->json(['disconnected' => true]);
    }

    // POST /api/huawei/resync
    public function resync(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'huawei')
            ->first();

        if (!$connection) {
            return response()->json(['message' => 'Huawei not connected.'], 422);
        }

        if (!$this->ensureFreshToken($connection)) {
            return response()->json(['message' => 'Huawei token refresh failed.'], 422);
        }

        $synced = $this->backfillHuawei($connection, $sync);

        return response()->json(['connected' => true, 'synced' => $synced]);
    }

    private function ensureFreshToken(ProviderConnection $connection): ?string
    {
        if ($connection->token_expires_at && $connection->token_expires_at->isFuture()) {
            return $connection->access_token;
        }

        $res = Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/token', [
            'grant_type'    => 'refresh_token',
            'refresh_token' => $connection->refresh_token,
            'client_id'     => config('services.huawei.client_id'),
            'client_secret' => config('services.huawei.client_secret'),
        ]);

        if (!$res->successful()) return null;

        $data = $res->json();
        $connection->update([
            'access_token'     => $data['access_token'],
            'refresh_token'    => $data['refresh_token'] ?? $connection->refresh_token,
            'token_expires_at' => isset($data['expires_in']) ? now()->addSeconds((int) $data['expires_in']) : now()->addHour(),
        ]);

        return $data['access_token'];
    }

    private function backfillHuawei(ProviderConnection $connection, TrainingSyncService $sync): int
    {
        $accessToken = $this->ensureFreshToken($connection) ?? $connection->access_token;

        $res = Http::withToken($accessToken)
            ->withHeaders(['x-client-id' => config('services.huawei.client_id')])
            ->get('https://health-api.cloud.huawei.com/healthkit/v2/activityRecords', [
                'startTime' => now()->subDays(90)->getTimestampMs(),
                'endTime'   => now()->getTimestampMs(),
            ]);

        if (!$res->successful()) {
            Log::warning('Huawei activity fetch failed', [
                'status' => $res->status(),
                'body'   => Str::limit($res->body(), 1000),
            ]);
            return 0;
        }

        $count = 0;
        // Confirmed key is "activityRecord" (singular) — not the "activityRecords" the
        // endpoint's own doc title ("Querying Created Activity Records") would suggest.
        foreach ($res->json('activityRecord') ?? [] as $activity) {
            if ($sync->storeHuaweiActivity($connection->user, $activity)) {
                $count++;
            }
        }

        $connection->update(['last_synced_at' => now()]);

        return $count;
    }
}
