<?php

namespace App\Services;

use App\Models\ProviderAuthorizationEvent;
use App\Models\ProviderConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class HuaweiSyncService
{
    // Data scopes training sync needs. If the user unchecks either on the HUAWEI ID
    // consent screen, sync is disabled and the user is asked to re-authorize
    // (App Release Checklist 3.4) — the rest of FitMeet keeps working.
    public const REQUIRED_SCOPES = [
        'https://www.huawei.com/healthkit/activityrecord.read',
        'https://www.huawei.com/healthkit/activity.read',
    ];

    /** Required scopes missing from a token's granted scope string ([] when Huawei didn't report scopes). */
    public function missingScopes(?string $granted): array
    {
        if ($granted === null || trim($granted) === '') {
            return [];
        }
        $have = preg_split('/\s+/', trim($granted));

        return array_values(array_diff(self::REQUIRED_SCOPES, $have));
    }

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

        if (!$res->successful()) {
            // A refused refresh token (4xx) means the user cancelled FitMeet's authorization
            // in the HUAWEI Health app / HUAWEI ID — not a transient outage (5xx).
            if ($res->clientError()) {
                $connection->markStatus(ProviderConnection::REVOKED, ProviderAuthorizationEvent::REVOKED_BY_PROVIDER);
            }
            return null;
        }

        $data = $res->json();
        $connection->update([
            'access_token'     => $data['access_token'],
            'refresh_token'    => $data['refresh_token'] ?? $connection->refresh_token,
            'token_expires_at' => isset($data['expires_in']) ? now()->addSeconds((int) $data['expires_in']) : now()->addHour(),
        ]);

        return $data['access_token'];
    }

    private function fetchRecords(string $accessToken, int $days): Response
    {
        return Http::withToken($accessToken)
            ->withHeaders(['x-client-id' => config('services.huawei.client_id')])
            ->get('https://health-api.cloud.huawei.com/healthkit/v2/activityRecords', [
                'startTime' => now()->subDays($days)->getTimestampMs(),
                'endTime'   => now()->getTimestampMs(),
            ]);
    }

    /**
     * Turn a refused data request into a connection status the apps can explain:
     * 401 = authorization cancelled; 403 naming a scope/permission = a required
     * permission not granted; any other 403 = data access off on Huawei's side
     * (e.g. the HUAWEI Health Kit switch in the HUAWEI Health app). 5xx/network
     * errors leave the status alone — they're outages, not user decisions.
     */
    private function handleRefusal(ProviderConnection $connection, Response $res): void
    {
        if ($res->status() === 401) {
            $connection->markStatus(ProviderConnection::REVOKED, ProviderAuthorizationEvent::REVOKED_BY_PROVIDER);
        } elseif ($res->status() === 403) {
            $body = strtolower($res->body());
            str_contains($body, 'scope') || str_contains($body, 'permission')
                ? $connection->markStatus(ProviderConnection::INSUFFICIENT_SCOPE, ProviderAuthorizationEvent::INSUFFICIENT_SCOPE)
                : $connection->markStatus(ProviderConnection::UNAVAILABLE, ProviderAuthorizationEvent::PROVIDER_UNAVAILABLE);
        }
    }

    /**
     * Live check whether FitMeet can still read the user's HUAWEI Health data — run
     * when the app starts, so a revocation or a switched-off Health Kit is reported
     * right away instead of at the next 15-minute poll. Returns the resulting status.
     */
    public function verify(ProviderConnection $connection): string
    {
        if ($connection->status === ProviderConnection::REVOKED || $connection->status === ProviderConnection::INSUFFICIENT_SCOPE) {
            return $connection->status; // only a fresh authorization fixes these
        }

        $accessToken = $this->ensureFreshToken($connection);
        if ($accessToken === null) {
            return $connection->fresh()->status;
        }

        $res = $this->fetchRecords($accessToken, 1);
        if ($res->successful()) {
            // e.g. HUAWEI Health Kit switched back on
            if ($connection->status === ProviderConnection::UNAVAILABLE) {
                $connection->markStatus(ProviderConnection::ACTIVE, ProviderAuthorizationEvent::GRANTED);
            }
        } else {
            $this->handleRefusal($connection, $res);
        }

        return $connection->fresh()->status;
    }

    public function backfillHuawei(ProviderConnection $connection, TrainingSyncService $sync): int
    {
        if ($connection->status !== null && $connection->status !== ProviderConnection::ACTIVE) {
            return 0;
        }

        $accessToken = $this->ensureFreshToken($connection);
        if ($accessToken === null) {
            return 0;
        }

        $res = $this->fetchRecords($accessToken, 90);

        if (!$res->successful()) {
            $this->handleRefusal($connection, $res);
            // Status code only — response bodies may contain user data, which the
            // privacy policy promises never to write to logs.
            Log::warning('Huawei activity fetch failed', [
                'status'        => $res->status(),
                'connection_id' => $connection->id,
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
