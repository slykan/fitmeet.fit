<?php

namespace App\Services;

use App\Models\ProviderConnection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class HuaweiSyncService
{
    public function ensureFreshToken(ProviderConnection $connection): ?string
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

    public function backfillHuawei(ProviderConnection $connection, TrainingSyncService $sync): int
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
