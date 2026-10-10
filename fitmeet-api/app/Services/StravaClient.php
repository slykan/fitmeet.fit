<?php

namespace App\Services;

use App\Models\ProviderConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Strava API calls for the training-detail import, with the app-wide rate limit in
 * mind: every response reports usage (X-ReadRateLimit-*), which is cached so the
 * background import backs off well before the limit and leaves room for webhooks.
 */
class StravaClient
{
    /** Background work stops at this share of the 15-min / daily read limit. */
    private const BACKGROUND_SHARE = 0.7;

    private const USAGE_KEY = 'strava_read_rate';

    public function freshToken(ProviderConnection $connection): ?string
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

    public function get(string $token, string $path, array $query = []): Response
    {
        $res = Http::withToken($token)->timeout(30)->get('https://www.strava.com/api/v3/' . ltrim($path, '/'), $query);
        $this->rememberUsage($res);

        return $res;
    }

    /**
     * Seconds the background import should wait before its next call (0 = go ahead).
     */
    public function backgroundWaitSeconds(): int
    {
        $u = Cache::get(self::USAGE_KEY);
        if (!$u) {
            return 0;
        }
        if ($u['daily_limit'] && $u['daily'] >= $u['daily_limit'] * self::BACKGROUND_SHARE) {
            return (int) now()->diffInSeconds(now()->utc()->endOfDay()) + 120;
        }
        if ($u['short_limit'] && $u['short'] >= $u['short_limit'] * self::BACKGROUND_SHARE) {
            return 16 * 60;
        }

        return 0;
    }

    private function rememberUsage(Response $res): void
    {
        // "100,1000" = 15-minute, daily. Read limits apply to GETs; fall back to the overall ones.
        $limit = $res->header('X-ReadRateLimit-Limit') ?: $res->header('X-RateLimit-Limit');
        $usage = $res->header('X-ReadRateLimit-Usage') ?: $res->header('X-RateLimit-Usage');
        if (!$limit || !$usage) {
            return;
        }

        [$shortLimit, $dailyLimit] = array_map('intval', explode(',', $limit) + [0, 0]);
        [$short, $daily] = array_map('intval', explode(',', $usage) + [0, 0]);

        // The 15-minute window resets on the quarter hour, the daily one at midnight UTC.
        Cache::put(self::USAGE_KEY, compact('short', 'daily') + [
            'short_limit' => $shortLimit,
            'daily_limit' => $dailyLimit,
        ], now()->addMinutes(15 - now()->minute % 15));
    }
}
