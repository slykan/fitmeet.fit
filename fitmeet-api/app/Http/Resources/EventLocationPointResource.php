<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventLocationPointResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'lat' => (float) $this->lat,
            'lng' => (float) $this->lng,
            'speed_kmh' => $this->speed_kmh !== null ? (float) $this->speed_kmh : null,
            'recorded_at' => $this->recorded_at->toIso8601String(),
        ];
    }
}
