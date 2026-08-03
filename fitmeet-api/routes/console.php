<?php

use App\Jobs\SendPushNotification;
use App\Jobs\SendStartedEventNotifications;
use App\Mail\EventReminderMail;
use App\Models\ActivityRoute;
use App\Models\Event;
use App\Models\EventReminder;
use App\Models\User;
use App\Services\BadgeService;
use App\Services\GpxElevationEnricher;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

Artisan::command('gpx:embed-elevation', function () {
    $enricher = app(GpxElevationEnricher::class);
    $enriched = 0;
    $skipped = 0;

    ActivityRoute::query()->whereNotNull('gpx_path')->chunkById(50, function ($routes) use ($enricher, &$enriched, &$skipped) {
        foreach ($routes as $route) {
            if (! Storage::disk('public')->exists($route->gpx_path)) {
                $skipped++;
                continue;
            }
            $xml = Storage::disk('public')->get($route->gpx_path);
            $result = $enricher->embed($xml);
            if ($result === null) {
                $skipped++;
                continue;
            }
            Storage::disk('public')->put($route->gpx_path, $result);
            $enriched++;
            $this->line("route #{$route->id}: embedded elevation");
        }
    });

    // Events that don't share a gpx_path with one of the routes above (e.g. private events).
    $routeGpxPaths = ActivityRoute::query()->whereNotNull('gpx_path')->pluck('gpx_path')->all();
    Event::query()->whereNotNull('gpx_path')->whereNotIn('gpx_path', $routeGpxPaths)
        ->chunkById(50, function ($events) use ($enricher, &$enriched, &$skipped) {
            foreach ($events as $event) {
                if (! Storage::disk('public')->exists($event->gpx_path)) {
                    $skipped++;
                    continue;
                }
                $xml = Storage::disk('public')->get($event->gpx_path);
                $result = $enricher->embed($xml);
                if ($result === null) {
                    $skipped++;
                    continue;
                }
                Storage::disk('public')->put($event->gpx_path, $result);
                $enriched++;
                $this->line("event #{$event->id}: embedded elevation");
            }
        });

    $this->info("Done. Embedded: {$enriched}, skipped (already had elevation / no file / lookup failed): {$skipped}.");
})->purpose('Backfill elevation into existing GPX files that are missing it');

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
        ->where('start_at', '<=', now()->addMinutes(10))
        ->where('start_at', '>=', now()->addMinutes(5))
        ->whereNotExists(function ($query) {
            $query->selectRaw('1')
                ->from('event_notifications')
                ->whereColumn('event_notifications.event_id', 'events.id')
                ->where('event_notifications.type', 'event_started')
                ->limit(1);
        })
        ->get();

    foreach ($events as $event) {
        SendStartedEventNotifications::dispatch($event);
    }

    $this->info("Dispatched {$events->count()} event(s) starting soon.");
})->purpose('Send notifications before joined events start');

Schedule::command('events:send-started')->everyMinute();

Artisan::command('moments:send-reminders', function () {
    $window = now()->subMinutes(15);

    // Fire after event ends: start_at + duration_minutes (0 treated as null → 120 min fallback)
    $events = Event::query()
        ->where('status', 'active')
        ->where('is_private', false)
        ->whereNull('moment_image_path')
        ->whereRaw("DATE_ADD(start_at, INTERVAL COALESCE(NULLIF(duration_minutes, 0), 120) MINUTE) <= UTC_TIMESTAMP()")
        ->whereRaw("DATE_ADD(start_at, INTERVAL COALESCE(NULLIF(duration_minutes, 0), 120) MINUTE) > ?", [$window])
        ->with('organizer')
        ->get();

    foreach ($events as $event) {
        if (! $event->organizer) continue;

        $notification = \App\Models\EventNotification::firstOrCreate([
            'user_id'  => $event->user_id,
            'event_id' => $event->id,
            'type'     => 'moment_reminder',
        ]);

        if (! $notification->wasRecentlyCreated) continue;

        SendPushNotification::dispatch(
            [$event->user_id],
            '📸 Add your Moment!',
            "How did {$event->title} go? Upload a photo to Moments.",
            [
                'type'     => 'moment_reminder',
                'event_id' => $event->id,
            ],
        );
    }

    $this->info("Sent moment reminders for {$events->count()} event(s).");
})->purpose('Send moment upload reminders to organizers after events end');

Schedule::command('moments:send-reminders')->everyFifteenMinutes();

Artisan::command('birthday:send', function () {
    $todayUtc  = now()->utc();
    $todayMonth = (int) $todayUtc->format('m');
    $todayDay   = (int) $todayUtc->format('d');
    $todayDate  = $todayUtc->toDateString();

    // Find users whose birthday is today (day + month match), not yet notified today,
    // and whose estimated local hour is between 8 and 9.
    // Timezone is approximated from home_lng: offset_hours = round(lng / 15).
    // We send when UTC_hour == (8 - offset + 24) % 24, i.e. when it's ~8 AM locally.
    $currentUtcHour = (int) $todayUtc->format('H');

    $users = \App\Models\User::whereNotNull('birth_date')
        ->whereMonth('birth_date', $todayMonth)
        ->whereDay('birth_date', $todayDay)
        ->where(fn ($q) => $q->whereNull('birthday_notified_date')
            ->orWhereDate('birthday_notified_date', '<', $todayDate))
        ->whereHas('pushTokens')
        ->get();

    $sent = 0;
    foreach ($users as $user) {
        $lng    = $user->home_lng ?? 0;
        $offset = (int) round($lng / 15);
        $localHour = (($currentUtcHour + $offset) % 24 + 24) % 24;

        if ($localHour < 8 || $localHour >= 9) continue;

        \App\Jobs\SendPushNotification::dispatch(
            [$user->id],
            '🎂 Happy Birthday, ' . $user->name . '!',
            'Wishing you a wonderful day full of movement and joy. — FitMeet.Fit 🎉',
            ['type' => 'birthday'],
        );

        \App\Models\Announcement::create([
            'sent_by'        => null,
            'title'          => '🎂 Happy Birthday, ' . $user->name . '!',
            'body'           => "Wishing you a wonderful day full of movement, great people, and joy.\n\nWith warmth — the FitMeet.Fit team 🎉",
            'data'           => ['type' => 'birthday'],
            'target_user_id' => $user->id,
        ]);

        $user->update(['birthday_notified_date' => $todayDate]);
        $sent++;
    }

    $this->info("Sent birthday notifications to {$sent} user(s).");
})->purpose('Send birthday push notifications around 8 AM local time');

Schedule::command('birthday:send')->hourly();

Artisan::command('strava:subscribe-webhook', function () {
    $res = \Illuminate\Support\Facades\Http::asForm()->post('https://www.strava.com/api/v3/push_subscriptions', [
        'client_id'     => config('services.strava.client_id'),
        'client_secret' => config('services.strava.client_secret'),
        'callback_url'  => config('app.url') . '/api/strava/webhook',
        'verify_token'  => config('services.strava.webhook_verify_token'),
    ]);

    if ($res->successful()) {
        $this->info('Subscribed: ' . json_encode($res->json()));
    } else {
        $this->error('Failed: ' . $res->body());
    }
})->purpose('Register the Strava webhook subscription (run once per environment)');

Artisan::command('badges:backfill', function () {
    $badgeService = app(BadgeService::class);
    $granted = 0;

    User::query()->chunkById(200, function ($users) use ($badgeService, &$granted) {
        foreach ($users as $user) {
            $granted += count($badgeService->evaluate($user, notify: false));
        }
    });

    $this->info("Backfill complete. Granted {$granted} badge(s).");
})->purpose('Silently grant already-earned badges to existing users (no push notifications)');
