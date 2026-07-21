<?php

namespace App\Models;

use App\Enums\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Training extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'external_id',
        'category',
        'raw_type',
        'name',
        'started_at',
        'duration_s',
        'distance_m',
        'elevation_gain',
        'dedup_group_id',
        'is_primary',
    ];

    protected function casts(): array
    {
        return [
            'category'       => Category::class,
            'started_at'     => 'datetime',
            'duration_s'     => 'integer',
            'distance_m'     => 'float',
            'elevation_gain' => 'float',
            'is_primary'     => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
