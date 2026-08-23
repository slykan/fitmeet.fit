<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderStoppedNotification extends Model
{
    protected $fillable = ['user_id', 'event_id', 'stopped_user_id', 'read_at'];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function stoppedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'stopped_user_id');
    }
}
