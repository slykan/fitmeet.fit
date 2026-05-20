<?php

namespace App\Jobs;

use App\Mail\EventStartedMail;
use App\Models\Event;
use App\Models\EventNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendStartedEventNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly Event $event) {}

    public function handle(): void
    {
        $event = $this->event->loadMissing('participants');
        $pushRecipientIds = [];

        foreach ($event->participants as $user) {
            $notification = EventNotification::firstOrCreate([
                'user_id' => $user->id,
                'event_id' => $event->id,
                'type' => 'event_started',
            ]);

            if (! $notification->wasRecentlyCreated) {
                continue;
            }

            $pushRecipientIds[] = $user->id;

            if ($user->email_event_reminders) {
                try {
                    Mail::to($user->email)->send(new EventStartedMail($event, $user));
                } catch (\Throwable) {
                }
            }
        }

        if (! empty($pushRecipientIds)) {
            SendPushNotification::dispatch(
                array_values(array_unique($pushRecipientIds)),
                '📍 Starting soon — tap to check in',
                $event->title,
                [
                    'type'        => 'event_started',
                    'event_id'    => $event->id,
                    'categoryId'  => 'event_started',
                    'channelId'   => 'event_started',
                    '_data_only'  => 'true',
                    '_title'      => '📍 Starting soon — tap to check in',
                    '_body'       => $event->title,
                ],
            );
        }
    }
}
