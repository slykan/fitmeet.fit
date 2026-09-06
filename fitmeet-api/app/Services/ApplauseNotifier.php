<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\Event;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Pushes a "X sent applause" notification to every other joined participant
 * when someone applauds a live event, so a muted phone still surfaces it
 * (the in-app sound alone is easy to miss). Throttled per event so a burst
 * of applause doesn't spam everyone with one push per tap.
 */
class ApplauseNotifier
{
    private const THROTTLE_MINUTES = 2;

    public function notify(Event $event, User $sender): void
    {
        if (! Cache::add("applause_notify_lock_event_{$event->id}", true, now()->addMinutes(self::THROTTLE_MINUTES))) {
            return;
        }

        $recipientIds = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('status', 'joined')
            ->where('user_id', '!=', $sender->id)
            ->pluck('user_id')
            ->all();

        if (empty($recipientIds)) {
            return;
        }

        $title = '👏 Applause!';
        $body = "{$sender->name} sent applause during {$event->title}";

        SendPushNotification::dispatch(
            $recipientIds,
            $title,
            $body,
            [
                'type' => 'applause_sent',
                'event_id' => $event->id,
                'channelId' => 'applause_sent',
                '_data_only' => 'true',
                '_title' => $title,
                '_body' => $body,
            ],
        );
    }
}
