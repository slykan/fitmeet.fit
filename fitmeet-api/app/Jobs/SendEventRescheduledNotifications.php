<?php

namespace App\Jobs;

use App\Mail\EventRescheduledMail;
use App\Models\Event;
use App\Models\EventNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

class SendEventRescheduledNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public readonly Event $event,
        public readonly ?Carbon $previousStartAt = null,
    ) {}

    public function handle(): void
    {
        $event = $this->event->loadMissing('organizer', 'participants');
        $pushRecipientIds = [];

        $tz = $event->timezone ?? config('app.event_timezone');
        $newStart = $event->start_at->copy()->timezone($tz);

        foreach ($event->participants as $user) {
            if ($user->id === $event->user_id) {
                continue;
            }

            $pushRecipientIds[] = $user->id;

            // event_notifications has a unique (user_id, event_id, type) constraint, and an
            // event can be rescheduled more than once — upsert so a repeat change resurfaces
            // the same notification as unread instead of failing on the duplicate insert.
            // created_at/updated_at are set directly (not via fill()) since they aren't mass-assignable.
            $notification = EventNotification::firstOrNew([
                'user_id' => $user->id,
                'event_id' => $event->id,
                'type' => 'event_rescheduled',
            ]);
            $notification->read_at = null;
            $notification->created_at = now();
            $notification->updated_at = now();
            $notification->save();

            if ($user->email_event_reminders) {
                try {
                    Mail::to($user->email)->send(new EventRescheduledMail($event, $user, $this->previousStartAt));
                } catch (\Throwable) {
                }
            }
        }

        if (! empty($pushRecipientIds)) {
            SendPushNotification::dispatch(
                array_values(array_unique($pushRecipientIds)),
                'Event time changed',
                "{$event->title} is now on {$newStart->format('D, d M · H:i')}",
                [
                    'type' => 'event_rescheduled',
                    'event_id' => $event->id,
                ],
            );
        }
    }
}
