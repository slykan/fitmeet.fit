<?php

namespace App\Models;

use App\Enums\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'category',
        'lat',
        'lng',
        'address',
        'timezone',
        'start_at',
        'duration_minutes',
        'distance_km',
        'elevation_gain',
        'pace',
        'max_grade',
        'max_downgrade',
        'gpx_path',
        'route_id',
        'image_path',
        'moment_image_path',
        'moment_cover_x',
        'moment_cover_y',
        'youtube_url',
        'skill_level',
        'max_participants',
        'is_private',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'start_at'         => 'datetime',
            'lat'              => 'float',
            'lng'              => 'float',
            'is_private'       => 'boolean',
            'distance_km'      => 'float',
            'moment_cover_x'   => 'float',
            'moment_cover_y'   => 'float',
            'category'         => Category::class,
        ];
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_participants')
            ->withPivot('status', 'joined_at', 'notify_on_join', 'checked_in_at')
            ->wherePivot('status', 'joined');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(EventComment::class);
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(ActivityRoute::class, 'route_id');
    }

    public function isFull(): bool
    {
        return $this->max_participants !== null
            && $this->participants_count >= $this->max_participants;
    }

    public function isOrganizer(User $user): bool
    {
        return $this->user_id === $user->id;
    }

    // Scope: future events + in-progress events
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query
            ->whereIn('events.status', ['active', 'cancelled'])
            ->where(function ($q) {
                // Not yet started
                $q->where('events.start_at', '>', now())
                // OR in-progress: started but end time not reached
                ->orWhere(function ($q2) {
                    $q2->where('events.start_at', '<=', now())
                       ->whereRaw('DATE_ADD(events.start_at, INTERVAL COALESCE(events.duration_minutes, 60) MINUTE) >= ?', [now()]);
                });
            });
    }

    // Scope: events within $radiusKm of given coordinates
    public function scopeNearby(Builder $query, float $lat, float $lng, int $radiusKm): Builder
    {
        return $query
            ->addSelect(\DB::raw("(
                6371 * ACOS(
                    LEAST(1, GREATEST(-1,
                        COS(RADIANS({$lat})) * COS(RADIANS(lat)) *
                        COS(RADIANS(lng) - RADIANS({$lng})) +
                        SIN(RADIANS({$lat})) * SIN(RADIANS(lat))
                    ))
                )
            ) AS distance_from_user"))
            ->having('distance_from_user', '<=', $radiusKm)
            ->orderBy('distance_from_user');
    }

    public function scopePublic(Builder $query): Builder
    {
        return $query->where('is_private', false);
    }
}
