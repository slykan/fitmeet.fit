<?php

namespace App\Models;

use App\Enums\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityRoute extends Model
{
    protected $table = 'routes';

    protected $fillable = [
        'user_id',
        'source_event_id',
        'title',
        'category',
        'distance_km',
        'elevation_gain',
        'max_grade',
        'max_downgrade',
        'start_lat',
        'start_lng',
        'end_lat',
        'end_lng',
        'area_label',
        'surface_type',
        'gpx_path',
        'is_public',
        'views_count',
    ];

    protected function casts(): array
    {
        return [
            'category' => Category::class,
            'distance_km' => 'float',
            'elevation_gain' => 'integer',
            'max_grade' => 'float',
            'max_downgrade' => 'float',
            'start_lat' => 'float',
            'start_lng' => 'float',
            'end_lat' => 'float',
            'end_lng' => 'float',
            'is_public' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function sourceEvent(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'source_event_id');
    }

    public function scopePublic(Builder $query): Builder
    {
        return $query->where('is_public', true);
    }
}
