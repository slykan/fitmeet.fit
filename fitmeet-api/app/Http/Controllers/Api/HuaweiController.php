<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RetryHuaweiBackfill;
use App\Models\ProviderConnection;
use App\Services\HuaweiSyncService;
use App\Services\TrainingSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
    public function connect(Request $request, HuaweiSyncService $huawei, TrainingSyncService $sync): JsonResponse
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

        $synced = $huawei->backfillHuawei($connection, $sync);

        // Huawei's cloud activity data can lag briefly right after a fresh OAuth grant
        // (device -> Huawei cloud sync isn't instant) -- if nothing came back on the
        // very first pull, retry once a couple minutes later instead of leaving the
        // user to notice and hit "Resync" manually.
        if ($synced === 0) {
            RetryHuaweiBackfill::dispatch($connection->id)->delay(now()->addMinutes(2));
        }

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
    public function resync(Request $request, HuaweiSyncService $huawei, TrainingSyncService $sync): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'huawei')
            ->first();

        if (!$connection) {
            return response()->json(['message' => 'Huawei not connected.'], 422);
        }

        if (!$huawei->ensureFreshToken($connection)) {
            return response()->json(['message' => 'Huawei token refresh failed.'], 422);
        }

        $synced = $huawei->backfillHuawei($connection, $sync);

        return response()->json(['connected' => true, 'synced' => $synced]);
    }
}
