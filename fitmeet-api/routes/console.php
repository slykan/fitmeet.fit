<?php

use App\Jobs\SendPushNotification;
use App\Mail\EventReminderMail;
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
