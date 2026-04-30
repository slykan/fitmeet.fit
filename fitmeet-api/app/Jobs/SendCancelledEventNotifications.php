<?php

namespace App\Jobs;

use App\Mail\EventCancelledMail;
use App\Models\Event;
use App\Models\EventNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendCancelledEventNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly Event $event) {}

    public function handle(): void
    {
        $event = $this->event->loadMissing('organizer', 'participants');
        $pushRecipientIds = [];

        foreach ($event->participants as $user) {
            if ($user->id === $event->user_id) {
                continue;
            }

            $pushRecipientIds[] = $user->id;

            EventNotification::firstOrCreate([
                'user_id'  => $user->id,
                'event_id' => $event->id,
                'type'     => 'event_cancelled',
            ]);

            if ($user->email_event_reminders) {
                try {
                    Mail::to($user->email)->send(new EventCancelledMail($event, $user));
                } catch (\Throwable) {
                }
            }
        }

        if (! empty($pushRecipientIds)) {
            SendPushNotification::dispatch(
                array_values(array_unique($pushRecipientIds)),
                'Event cancelled',
                $event->title,
                [
                    'type' => 'event_cancelled',
                    'event_id' => $event->id,
                ],
            );
        }
    }
}
