<?php

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

        if (! $reminder->user->email_event_reminders) {
            $reminder->update(['sent_at' => now()]);
            continue;
        }

        try {
            Mail::to($reminder->user->email)->send(new EventReminderMail($reminder));
            $reminder->update(['sent_at' => now()]);
        } catch (\Throwable $e) {
            $this->error("Failed reminder #{$reminder->id}: {$e->getMessage()}");
        }
    }

    $this->info("Sent {$reminders->count()} reminder(s).");
})->purpose('Send pending event reminder emails');

Schedule::command('reminders:send')->everyFifteenMinutes();
