<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id'          => $this->id,
            'title'       => $this->title,
            'description' => $this->description,
            'category'    => $this->category ? [
                'value' => $this->category->value,
                'label' => $this->category->label(),
                'group' => $this->category->group(),
            ] : ['value' => 'other', 'label' => 'Other', 'group' => 'Misc'],

            'location' => [
                'lat'     => $this->lat,
                'lng'     => $this->lng,
                'address' => $this->address,
            ],

            'schedule' => [
                'start_at'         => $this->start_at->toIso8601String(),
                'duration_minutes' => $this->duration_minutes,
            ],

            'activity' => [
                'distance_km'    => $this->distance_km,
                'elevation_gain' => $this->elevation_gain,
                'pace'           => $this->pace,
                'max_grade'      => $this->max_grade,
                'max_downgrade'  => $this->max_downgrade,
                'gpx_url'        => $this->gpx_path ? url("/api/events/{$this->id}/gpx") : null,
            ],

            'skill_level'        => $this->skill_level,
            'max_participants'   => $this->max_participants,
            'participants_count' => $this->participants_count,
            'is_full'            => $this->isFull(),
            'is_private'         => $this->is_private,
            'status'             => $this->status,

            'organizer'   => new UserResource($this->whenLoaded('organizer')),

            // Auth-dependent fields
            'is_organizer' => $user ? $this->isOrganizer($user) : false,
            'is_joined'    => $user ? $this->participants->contains($user->id) : false,

            // Distance from user (set by scopeNearby)
            'distance_km' => isset($this->distance_from_user)
                ? round($this->distance_from_user, 1)
                : null,

            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }
}
