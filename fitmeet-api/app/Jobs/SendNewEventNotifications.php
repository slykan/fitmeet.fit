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

        $query = User::query()
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
            END");

        if ($event->is_private) {
            // Private event — notify only accepted friends of the organizer
            $friendIds = FriendRequest::where(function ($q) use ($event) {
                $q->where('sender_id', $event->user_id)
                  ->orWhere('receiver_id', $event->user_id);
            })->where('status', 'accepted')
              ->get()
              ->map(fn ($r) => $r->sender_id === $event->user_id ? $r->receiver_id : $r->sender_id);

            $query->whereIn('id', $friendIds);
        }

        $users = $query->get();

        foreach ($users as $user) {
            EventNotification::firstOrCreate([
                'user_id'  => $user->id,
                'event_id' => $event->id,
                'type'     => 'new_event',
            ]);

            if ($user->email_new_events) {
                try {
                    Mail::to($user->email)->send(new NewEventMail($event, $user));
                } catch (\Throwable) {}
            }
        }
    }
}
