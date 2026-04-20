<?php

namespace App\Jobs;

use App\Models\Event;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

class SendEventPushNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly Event $event) {}

    public function handle(Messaging $messaging): void
    {
        $event = $this->event;

        // Find users within their chosen radius who follow this category
        $tokens = User::query()
            ->whereNotNull('fcm_token')
            ->whereNotNull('lat')
            ->whereNotNull('lng')
            ->where('id', '!=', $event->user_id)
            ->whereRaw("JSON_CONTAINS(categories, ?)", [json_encode($event->category->value)])
            ->selectRaw("fcm_token, radius, (
                6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(lat)) *
                    COS(RADIANS(lng) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(lat))
                )
            ) AS distance_from_event", [$event->lat, $event->lng, $event->lat])
            ->havingRaw("distance_from_event <= CASE radius
                WHEN 'nearby'    THEN 50
                WHEN 'city'      THEN 200
                WHEN 'region'    THEN 500
                WHEN 'unlimited' THEN 9999
                ELSE 50
            END")
            ->pluck('fcm_token')
            ->toArray();

        if (empty($tokens)) {
            return;
        }

        $notification = Notification::create(
            title: "New {$event->category->label()} event nearby!",
            body: "{$event->title} — {$event->start_at->format('D, M j \a\t g:i A')}"
        );

        // FCM supports max 500 tokens per multicast
        foreach (array_chunk($tokens, 500) as $chunk) {
            $message = CloudMessage::new()
                ->withNotification($notification)
                ->withData([
                    'event_id'     => (string) $event->id,
                    'category'     => $event->category->value,
                    'lat'          => (string) $event->lat,
                    'lng'          => (string) $event->lng,
                    'click_action' => 'OPEN_EVENT',
                ]);

            $messaging->sendMulticast($message, $chunk);
        }
    }
}
