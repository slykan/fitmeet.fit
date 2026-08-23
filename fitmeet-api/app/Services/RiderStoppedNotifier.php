<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\Event;
use App\Models\RiderStoppedNotification;
use App\Models\User;

/**
 * Notifies every other checked-in participant of an event once a live-tracked
 * rider has been stationary for ~60s (see EventController::updateLocation).
 * One notification per (recipient, event, stopped rider) — a rider stopping
 * repeatedly during the same event doesn't re-notify.
 */
class RiderStoppedNotifier
{
    public function notify(Event $event, User $stoppedUser): void
    {
        $recipientIds = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('status', 'joined')
            ->where('user_id', '!=', $stoppedUser->id)
            ->whereNotNull('checked_in_at')
            ->pluck('user_id');

        if ($recipientIds->isEmpty()) {
            return;
        }

        $pushRecipientIds = [];

        foreach ($recipientIds as $recipientId) {
            $notification = RiderStoppedNotification::firstOrCreate([
                'user_id' => $recipientId,
                'event_id' => $event->id,
                'stopped_user_id' => $stoppedUser->id,
            ]);

            if ($notification->wasRecentlyCreated) {
                $pushRecipientIds[] = $recipientId;
            }
        }

        if (empty($pushRecipientIds)) {
            return;
        }

        $title = 'Check on them?';
        $body = "{$stoppedUser->name} hasn't moved in a while during {$event->title}";

        SendPushNotification::dispatch(
            $pushRecipientIds,
            $title,
            $body,
            [
                'type' => 'rider_stopped',
                'event_id' => $event->id,
                'stopped_user_id' => $stoppedUser->id,
                'categoryId' => 'rider_stopped',
                'channelId' => 'rider_stopped',
                '_data_only' => 'true',
                '_title' => $title,
                '_body' => $body,
            ],
        );
    }
}
