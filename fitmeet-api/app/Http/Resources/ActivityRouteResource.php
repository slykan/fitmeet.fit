<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityRouteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category ? [
                'value' => $this->category->value,
                'label' => $this->category->label(),
                'group' => $this->category->group(),
            ] : ['value' => 'other', 'label' => 'Other', 'group' => 'Misc'],
            'stats' => [
                'distance_km' => $this->distance_km,
                'elevation_gain' => $this->elevation_gain,
                'max_grade' => $this->max_grade,
                'max_downgrade' => $this->max_downgrade,
            ],
            'location' => [
                'start_lat' => $this->start_lat,
                'start_lng' => $this->start_lng,
                'end_lat' => $this->end_lat,
                'end_lng' => $this->end_lng,
                'area_label' => $this->area_label,
            ],
            'surface_type' => $this->surface_type,
            'gpx_url' => $this->gpx_path ? url('/storage/' . $this->gpx_path) : null,
            'source_event_id' => $this->source_event_id,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'views_count' => $this->views_count ?? 0,
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
