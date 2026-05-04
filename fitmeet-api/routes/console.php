<?php

use App\Jobs\SendPushNotification;
use App\Jobs\SendStartedEventNotifications;
use App\Mail\EventReminderMail;
use App\Models\Event;
use App\Models\EventReminder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reminders:send', function () {
    $reminders = EventReminder::with(['user', 'event'])
        ->whereNull('sent_at')
        ->where('remind_at', '<=', now())
        ->get();

    foreach ($reminders as $reminder) {
        if ($reminder->event->status !== 'active') {
            $reminder->update(['sent_at' => now()]);
            continue;
        }

        if ($reminder->user->email_event_reminders) {
            try {
                Mail::to($reminder->user->email)->send(new EventReminderMail($reminder));
            } catch (\Throwable $e) {
                $this->error("Failed reminder #{$reminder->id}: {$e->getMessage()}");
            }
        }

        SendPushNotification::dispatch(
            [$reminder->user_id],
            'Event reminder',
            $reminder->event->title,
            [
                'type' => 'event_reminder',
                'event_id' => $reminder->event_id,
                'remind_offset' => $reminder->remind_offset,
            ],
        );

        $reminder->update(['sent_at' => now()]);
    }

    $this->info("Sent {$reminders->count()} reminder(s).");
})->purpose('Send pending event reminder emails');

Schedule::command('reminders:send')->everyFifteenMinutes();

Artisan::command('events:send-started', function () {
    $events = Event::query()
        ->where('status', 'active')
        ->where('start_at', '<=', now())
        ->where('start_at', '>=', now()->subMinutes(5))
        ->whereDoesntHave('participants', function ($query) {
            $query->whereExists(function ($subquery) {
                $subquery->selectRaw('1')
                    ->from('event_notifications')
                    ->whereColumn('event_notifications.event_id', 'events.id')
                    ->whereColumn('event_notifications.user_id', 'users.id')
                    ->where('event_notifications.type', 'event_started');
            });
        })
        ->get();

    foreach ($events as $event) {
        SendStartedEventNotifications::dispatchSync($event);
    }

    $this->info("Checked {$events->count()} started event(s).");
})->purpose('Send notifications when joined events start');

Schedule::command('events:send-started')->everyMinute();
