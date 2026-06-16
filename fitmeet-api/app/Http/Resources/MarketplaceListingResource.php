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
            ],
            'images'      => $this->whenLoaded('images', fn () =>
                $this->images->map(fn ($img) => url('/storage/' . $img->path))->values()
            ),
            'seller'      => new UserResource($this->whenLoaded('seller')),
            'is_mine'     => $request->user()?->id === $this->user_id,
            'created_at'  => $this->created_at?->toDateTimeString(),
        ];
    }
}
