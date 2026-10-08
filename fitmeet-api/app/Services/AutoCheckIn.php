<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\Event;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Automatic check-in: the app watches a geofence around each joined event's meeting
 * point and reports arriving/leaving. Arriving while check-in is open checks the user
 * in at once; arriving earlier is remembered (event_participants.present_at) and
 * checked in when check-in opens. Either way the user gets a "Checked in" push — which
 * also reaches a paired watch, so it works on any watch without a watch app.
 */
class AutoCheckIn
{
    /** How close the reported position must be to the meeting point. */
    public const MAX_DISTANCE_M = 300;

    /** Arriving earlier than this before check-in opens is not remembered. */
    public const EARLY_ARRIVAL_HOURS = 3;

    /** @return array{0: CarbonInterface, 1: CarbonInterface} same window as EventController::checkIn */
    public static function window(Event $event): array
    {
        return [
            $event->start_at->copy()->subMinutes(30),
            $event->start_at->copy()->addMinutes($event->duration_minutes ?? 60)->addHours(2),
        ];
    }

    public static function distanceM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $r * asin(min(1, sqrt($a)));
    }

    /** Check in a joined participant and send the confirmation push. False if already checked in. */
    public static function checkIn(Event $event, int $userId): bool
    {
        $updated = DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('user_id', $userId)
            ->where('status', 'joined')
            ->whereNull('checked_in_at')
            ->update(['checked_in_at' => now(), 'present_at' => null]);

        if (! $updated) {
            return false;
        }

        SendPushNotification::dispatch([$userId], 'Checked in ✓', $event->title, [
            'type'       => 'auto_checked_in',
            'event_id'   => $event->id,
            'channelId'  => 'event_started',
            '_data_only' => 'true',
            '_title'     => 'Checked in ✓',
            '_body'      => $event->title,
        ]);

        return true;
    }
}
