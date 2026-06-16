<?php

namespace App\Models;

use App\Enums\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketplaceListing extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'title',
        'description',
        'price',
        'currency',
        'condition',
        'category',
        'status',
        'location_city',
        'location_country',
        'lat',
        'lng',
    ];

    protected function casts(): array
    {
        return [
            'category' => Category::class,
            'price' => 'float',
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(MarketplaceListingImage::class, 'listing_id')->orderBy('sort_order');
    }
}
