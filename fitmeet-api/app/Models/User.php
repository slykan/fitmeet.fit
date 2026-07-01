<?php

namespace App\Models;

use App\Models\BeerDonation;
use App\Models\Event;
use App\Models\EventComment;
use App\Models\Conversation;
use App\Models\UserPushToken;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'apple_id',
        'strava_id',
        'avatar',
        'phone',
        'hide_phone',
        'email_friend_requests',
        'email_new_events',
        'email_event_reminders',
        'email_friend_events',
        'push_notifications',
        'is_admin',
        'country',
        'city',
        'lat',
        'lng',
        'home_lat',
        'home_lng',
        'home_city',
        'home_country',
        'radius',
        'categories',
        'skill_level',
        'birth_date',
        'fcm_token',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'categories'        => 'array',
            'birth_date'        => 'date',
            'hide_phone'        => 'boolean',
            'email_friend_requests' => 'boolean',
            'email_new_events'      => 'boolean',
            'email_event_reminders' => 'boolean',
            'email_friend_events'   => 'boolean',
            'push_notifications'    => 'boolean',
            'is_admin'              => 'boolean',
            'lat'               => 'float',
            'lng'               => 'float',
            'home_lat'          => 'float',
            'home_lng'          => 'float',
        ];
    }

    // Radius range in km for geolocation queries
    public static array $radiusMap = [
        'nearby'    => 50,
        'city'      => 200,
        'region'    => 500,
        'unlimited' => 9999,
    ];

    public function getRadiusKmAttribute(): int
    {
        return self::$radiusMap[$this->radius] ?? 50;
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    public function eventComments(): HasMany
    {
        return $this->hasMany(EventComment::class);
    }

    public function joinedEvents(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_participants')
            ->withPivot('status', 'joined_at', 'checked_in_at')
            ->wherePivot('status', 'joined');
    }

    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    public function pushTokens(): HasMany
    {
        return $this->hasMany(UserPushToken::class);
    }

    public function beerDonations(): HasMany
    {
        return $this->hasMany(BeerDonation::class);
    }

    public function isOnboardingComplete(): bool
    {
        return filled($this->phone)
            && filled($this->home_city)
            && filled($this->home_country);
    }
}
