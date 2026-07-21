<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderConnection extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'external_athlete_id',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'scope',
        'priority',
        'connected_at',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'access_token'     => 'encrypted',
            'refresh_token'    => 'encrypted',
            'token_expires_at' => 'datetime',
            'connected_at'     => 'datetime',
            'last_synced_at'   => 'datetime',
            'priority'         => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
