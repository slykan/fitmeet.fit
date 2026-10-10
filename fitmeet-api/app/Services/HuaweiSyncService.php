<?php

namespace App\Services;

use App\Models\ProviderAuthorizationEvent;
use App\Models\ProviderConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class HuaweiSyncService
{
    // Data scopes training sync needs. If the user unchecks either on the HUAWEI ID
    // consent screen, sync is disabled and the user is asked to re-authorize
    // (App Release Checklist 3.4) — the rest of FitMeet keeps working.
    /** Seconds after connecting during which the Health Kit switch reading is ignored. */
    private const FRESH_GRANT_GRACE_S = 60;

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

        $refresh = fn () => Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/token', [
            'grant_type'    => 'refresh_token',
            'refresh_token' => $connection->refresh_token,
            'client_id'     => config('services.huawei.client_id'),
            'client_secret' => config('services.huawei.client_secret'),
        ]);

        $res = $refresh();
        if ($res->clientError()) {
            sleep(2); // Huawei's token endpoint occasionally refuses a valid refresh token once
            $res = $refresh();
        }

        $failKey = "huawei_refresh_failures:{$connection->id}";
        if (!$res->successful()) {
            // Error code only — never tokens (privacy policy: no personal data in logs).
            Log::error('Huawei token refresh failed', [
                'connection_id' => $connection->id,
                'status'        => $res->status(),
                'error'         => $res->json('error'),
                'sub_error'     => $res->json('sub_error'),
            ]);
            // A single refused refresh is NOT proof of revocation: on 2026-10-06 one-off
            // refusals marked two live connections "revoked" and silently stopped their
            // sync. Only refusals on two separate attempts in a row (poll / app launch)
            // count; a real revocation is also caught at once by the data API's 401.
            if ($res->clientError()) {
                $failures = (int) Cache::get($failKey, 0) + 1;
                Cache::put($failKey, $failures, now()->addDay());
                if ($failures >= 2) {
                    $connection->markStatus(ProviderConnection::REVOKED, ProviderAuthorizationEvent::REVOKED_BY_PROVIDER);
                }
            }
            return null;
        }
        Cache::forget($failKey);

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
     * Right after a fresh authorization Huawei briefly reports the Health Kit switch as
     * off (opinion 2) — seen on 2026-10-09/10: every reconnect turned "unavailable" two
     * seconds later and the user looped on Reconnect. Ignore the switch for the first
     * minute after connecting; the data API answering is what counts then.
     */
    private function healthKitSwitchedOff(ProviderConnection $connection, string $accessToken): bool
    {
        if ($connection->connected_at && $connection->connected_at->gt(now()->subSeconds(self::FRESH_GRANT_GRACE_S))) {
            return false;
        }

        return $this->healthKitEnabled($accessToken) === false;
    }

    /**
     * Whether the HUAWEI Health Kit switch (HUAWEI Health › Privacy management) is on.
     * Switching it off does NOT make the data API refuse — activityRecords still answers
     * 200 — it only shows up here, as opinion 2 (1 = on). Null when the answer is unclear.
     */
    private function healthKitEnabled(string $accessToken): ?bool
    {
        $res = Http::withToken($accessToken)
            ->withHeaders(['x-client-id' => config('services.huawei.client_id')])
            ->get('https://health-api.cloud.huawei.com/healthkit/v1/profile/privacyRecords');
        $opinions = $res->successful() ? array_column((array) $res->json(), 'opinion') : [];

        return $opinions ? !in_array(2, $opinions) : null;
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
        if ($connection->status === ProviderConnection::INSUFFICIENT_SCOPE) {
            return $connection->status; // only a fresh authorization with all permissions fixes this
        }
        // REVOKED is re-checked too: if Huawei accepts the tokens again, the earlier refusal
        // was not a real revocation and the connection heals itself (below).

        $accessToken = $this->ensureFreshToken($connection);
        if ($accessToken === null) {
            return $connection->fresh()->status;
        }

        if ($this->healthKitSwitchedOff($connection, $accessToken)) {
            if ($connection->status !== ProviderConnection::UNAVAILABLE) {
                $connection->markStatus(ProviderConnection::UNAVAILABLE, ProviderAuthorizationEvent::PROVIDER_UNAVAILABLE);
            }
            return ProviderConnection::UNAVAILABLE;
        }

        $res = $this->fetchRecords($accessToken, 1);
        if ($res->successful()) {
            // e.g. HUAWEI Health Kit switched back on, or a revocation that wasn't one
            if (in_array($connection->status, [ProviderConnection::UNAVAILABLE, ProviderConnection::REVOKED], true)) {
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

        // Health Kit switched off: stop reading even though Huawei would still answer.
        if ($this->healthKitSwitchedOff($connection, $accessToken)) {
            $connection->markStatus(ProviderConnection::UNAVAILABLE, ProviderAuthorizationEvent::PROVIDER_UNAVAILABLE);
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
