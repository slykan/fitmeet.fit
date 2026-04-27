<?php

namespace App\Jobs;

use App\Mail\NewEventMail;
use App\Models\Event;
use App\Models\EventNotification;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendNewEventNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly Event $event) {}

    public function handle(): void
    {
        $event = $this->event;

        // ── Interest-based (public events only) ────────────────────────────────
        $interestUsers = collect();
        if (! $event->is_private) {
            $interestUsers = User::query()
                ->where('id', '!=', $event->user_id)
                ->whereNotNull('home_lat')
                ->whereNotNull('home_lng')
                ->whereRaw("JSON_CONTAINS(categories, ?)", [json_encode($event->category->value)])
                ->selectRaw("*, (
                    6371 * ACOS(
                        LEAST(1, GREATEST(-1,
                            COS(RADIANS(?)) * COS(RADIANS(home_lat)) *
                            COS(RADIANS(home_lng) - RADIANS(?)) +
                            SIN(RADIANS(?)) * SIN(RADIANS(home_lat))
                        ))
                    )
                ) AS dist_km", [$event->lat, $event->lng, $event->lat])
                ->havingRaw("dist_km <= CASE radius
                    WHEN 'nearby'    THEN 50
                    WHEN 'city'      THEN 200
                    WHEN 'region'    THEN 500
                    WHEN 'unlimited' THEN 9999
                    ELSE 50
                END")
                ->get();
        }

        // ── Friend-based (public AND private events) ────────────────────────────
        $friendIds = FriendRequest::where(function ($q) use ($event) {
            $q->where('sender_id', $event->user_id)
              ->orWhere('receiver_id', $event->user_id);
        })->where('status', 'accepted')
          ->get()
          ->map(fn ($r) => $r->sender_id === $event->user_id ? $r->receiver_id : $r->sender_id)
          ->unique()->values();

        $friendUsers = $friendIds->isNotEmpty()
            ? User::whereIn('id', $friendIds)->where('id', '!=', $event->user_id)->get()
            : collect();

        // ── Store in-app notifications + send emails ────────────────────────────
        $emailedIds = [];

        foreach ($interestUsers as $user) {
            EventNotification::firstOrCreate([
                'user_id'  => $user->id,
                'event_id' => $event->id,
                'type'     => 'new_event',
            ]);

            if ($user->email_new_events) {
                try {
                    Mail::to($user->email)->send(new NewEventMail($event, $user));
                    $emailedIds[] = $user->id;
                } catch (\Throwable) {}
            }
        }

        foreach ($friendUsers as $user) {
            EventNotification::firstOrCreate([
                'user_id'  => $user->id,
                'event_id' => $event->id,
                'type'     => 'new_event',
            ]);

            // Skip email if already sent via interest-based loop
            if (in_array($user->id, $emailedIds)) {
                continue;
            }

            $wantsMail = $user->email_friend_events === null ? true : (bool) $user->email_friend_events;
            if ($wantsMail) {
                try {
                    Mail::to($user->email)->send(new NewEventMail($event, $user));
                } catch (\Throwable) {}
            }
        }
    }
}
