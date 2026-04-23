<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'email'        => $this->email,
            'avatar'       => $this->avatar,
            'phone'        => ($this->hide_phone && $request->user()?->id !== $this->id) ? null : $this->phone,
            'hide_phone'   => (bool) $this->hide_phone,
            'email_preferences' => [
                'friend_requests' => (bool) $this->email_friend_requests,
                'new_events'      => (bool) $this->email_new_events,
                'event_reminders' => (bool) $this->email_event_reminders,
            ],

            'location' => [
                'lat' => $this->lat,
                'lng' => $this->lng,
            ],
            'home' => [
                'lat'     => $this->home_lat,
                'lng'     => $this->home_lng,
                'city'    => $this->home_city,
                'country' => $this->home_country,
            ],

            'radius'      => $this->radius,
            'radius_km'   => $this->radius_km,
            'categories'  => $this->categories ?? [],
            'skill_level' => $this->skill_level,

            'onboarding_complete' => $this->isOnboardingComplete(),

            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }
}
