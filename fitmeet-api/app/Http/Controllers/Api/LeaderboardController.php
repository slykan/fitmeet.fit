<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class LeaderboardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'beer'        => $this->beerSponsors(),
            'consistency' => $this->consistencyBeasts(),
            'creator'     => $this->eventCreators(),
            'connector'   => $this->connectors(),
            'legend'      => $this->localLegends(),
            'social'      => $this->socialAnimals(),
            'late'        => $this->alwaysLate(),
            'marketplace' => $this->marketplaceSellers(),
        ]);
    }

    private function withFallback(array $recent, string $fallbackSql, int $limit = 5): array
    {
        if (count($recent) >= $limit) return $recent;
        $exclude = implode(',', array_column($recent, 'id') ?: [0]);
        $needed  = $limit - count($recent);
        $fallback = DB::select(str_replace('__EXCLUDE__', $exclude, $fallbackSql) . " LIMIT {$needed}");
        return array_merge($recent, $fallback);
    }

    private function beerSponsors(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar,
                COALESCE(SUM(CASE bd.product_id
                    WHEN 'beer_large'  THEN 3
                    WHEN 'beer_medium' THEN 2
                    ELSE 1 END), 0) AS count
            FROM users u
            JOIN beer_donations bd ON bd.user_id = u.id
                AND bd.created_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar,
                COALESCE(SUM(CASE bd.product_id
                    WHEN 'beer_large'  THEN 3
                    WHEN 'beer_medium' THEN 2
                    ELSE 1 END), 0) AS count
            FROM users u
            JOIN beer_donations bd ON bd.user_id = u.id
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function consistencyBeasts(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id
                AND ep.status = 'joined'
                AND ep.joined_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id AND ep.status = 'joined'
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function eventCreators(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(e.id) AS count
            FROM users u
            JOIN events e ON e.user_id = u.id
                AND e.created_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(e.id) AS count
            FROM users u
            JOIN events e ON e.user_id = u.id
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function connectors(): array
    {
        return DB::select("
            SELECT id, name, avatar, invite_taps AS count
            FROM users
            WHERE invite_taps > 0
            ORDER BY invite_taps DESC
            LIMIT 5
        ");
    }

    private function localLegends(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id
                AND ep.checked_in_at IS NOT NULL
                AND ep.checked_in_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id AND ep.checked_in_at IS NOT NULL
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function socialAnimals(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(ec.id) AS count
            FROM users u
            JOIN event_comments ec ON ec.user_id = u.id
                AND ec.created_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(ec.id) AS count
            FROM users u
            JOIN event_comments ec ON ec.user_id = u.id
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function marketplaceSellers(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(ml.id) AS count
            FROM users u
            JOIN marketplace_listings ml ON ml.user_id = u.id
                AND ml.created_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(ml.id) AS count
            FROM users u
            JOIN marketplace_listings ml ON ml.user_id = u.id
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }

    private function alwaysLate(): array
    {
        $recent = DB::select("
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id
                AND ep.status = 'joined'
                AND ep.checked_in_at IS NULL
                AND ep.joined_at >= NOW() - INTERVAL 30 DAY
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
            LIMIT 5
        ");
        return $this->withFallback($recent, "
            SELECT u.id, u.name, u.avatar, COUNT(ep.id) AS count
            FROM users u
            JOIN event_participants ep ON ep.user_id = u.id
                AND ep.status = 'joined' AND ep.checked_in_at IS NULL
            WHERE u.id NOT IN (__EXCLUDE__)
            GROUP BY u.id, u.name, u.avatar
            ORDER BY count DESC
        ");
    }
}
