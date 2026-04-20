<?php

namespace App\Models;

use App\Enums\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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
        'start_at',
        'duration_minutes',
        'distance_km',
        'elevation_gain',
        'pace',
        'gpx_path',
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
            ->withPivot('status', 'joined_at')
            ->wherePivot('status', 'joined');
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

    // Scope: only active, future events
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', 'active')->where('start_at', '>', now());
    }

    // Scope: events within $radiusKm of given coordinates
    public function scopeNearby(Builder $query, float $lat, float $lng, int $radiusKm): Builder
    {
        return $query->selectRaw("*, (
            6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(lat)) *
                COS(RADIANS(lng) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(lat))
            )
        ) AS distance_from_user", [$lat, $lng, $lat])
        ->having('distance_from_user', '<=', $radiusKm)
        ->orderBy('distance_from_user');
    }

    public function scopePublic(Builder $query): Builder
    {
        return $query->where('is_private', false);
    }
}
