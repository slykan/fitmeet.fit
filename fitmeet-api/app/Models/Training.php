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
        'avg_heartrate',
        'max_heartrate',
        'avg_watts',
        'max_watts',
        'avg_cadence',
        'calories',
        'avg_speed_mps',
        'max_speed_mps',
        'kilojoules',
        'suffer_score',
        'gear_name',
        'description',
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
            'avg_heartrate'  => 'float',
            'max_heartrate'  => 'float',
            'avg_watts'      => 'float',
            'max_watts'      => 'float',
            'avg_cadence'    => 'float',
            'calories'       => 'float',
            'avg_speed_mps'  => 'float',
            'max_speed_mps'  => 'float',
            'kilojoules'     => 'float',
            'suffer_score'   => 'float',
            'is_primary'     => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
