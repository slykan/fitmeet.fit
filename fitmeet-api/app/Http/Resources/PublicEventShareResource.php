<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicEventShareResource extends JsonResource
{
    public function toArray(Request $request): array
    {
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
                'timezone'         => $this->timezone ?? config('app.event_timezone'),
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

            'organizer' => $this->whenLoaded('organizer', fn () => [
                'id'     => $this->organizer->id,
                'name'   => $this->organizer->name,
                'avatar' => $this->organizer->avatar,
            ]),

            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }
}
