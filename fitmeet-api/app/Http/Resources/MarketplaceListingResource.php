<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MarketplaceListingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'type'        => $this->type ?? 'sell',
            'title'       => $this->title,
            'description' => $this->description,
            'price'       => $this->price,
            'currency'    => $this->currency,
            'condition'   => $this->condition,
            'category'    => $this->category ? [
                'value' => $this->category->value,
                'label' => $this->category->label(),
            ] : ['value' => 'other', 'label' => 'Other'],
            'status'      => $this->status,
            'location'    => [
                'city'    => $this->location_city,
                'country' => $this->location_country,
                // taken from the seller's home, so only ~1 km precise for the map pin
                'lat'     => $this->lat !== null ? round((float) $this->lat, 2) : null,
                'lng'     => $this->lng !== null ? round((float) $this->lng, 2) : null,
            ],
            // only with ?near_lat/near_lng (Near me), whole km like the rounded pin
            'distance_km' => $this->distance_km !== null ? (int) round((float) $this->distance_km) : null,
            'images'      => $this->whenLoaded('images', fn () =>
                $this->images->map(fn ($img) => url('/storage/' . $img->path))->values()
            ),
            'images_meta' => $this->whenLoaded('images', fn () =>
                $this->images->map(fn ($img) => [
                    'id'  => $img->id,
                    'url' => url('/storage/' . $img->path),
                ])->values()
            ),
            'seller'      => new UserResource($this->whenLoaded('seller')),
            'is_mine'     => $request->user()?->id === $this->user_id,
            'views_count' => $this->views_count ?? 0,
            'saves_count' => $this->whenLoaded('savedByUsers', fn () => $this->savedByUsers->count(), 0),
            'is_saved'    => $this->whenLoaded('savedByUsers', fn () =>
                $this->savedByUsers->contains('id', $request->user()?->id), false
            ),
            'created_at'  => $this->created_at?->toDateTimeString(),
        ];
    }
}
