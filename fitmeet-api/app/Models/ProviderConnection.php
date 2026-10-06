<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderConnection extends Model
{
    // status: active | revoked (user withdrew access on the provider side) |
    // insufficient_scope (a required permission was unchecked on the consent screen) |
    // unavailable (provider refuses data, e.g. HUAWEI Health Kit switched off).
    // Anything but active means: stop syncing, ask the user to reconnect.
    public const ACTIVE             = 'active';
    public const REVOKED            = 'revoked';
    public const INSUFFICIENT_SCOPE = 'insufficient_scope';
    public const UNAVAILABLE        = 'unavailable';

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
        'status',
        'status_changed_at',
    ];

    protected function casts(): array
    {
        return [
            'access_token'     => 'encrypted',
            'refresh_token'    => 'encrypted',
            'token_expires_at' => 'datetime',
            'connected_at'     => 'datetime',
            'last_synced_at'   => 'datetime',
            'status_changed_at' => 'datetime',
            'priority'         => 'integer',
        ];
    }

    /** Change status once (no duplicate trail entries) and record why. */
    public function markStatus(string $status, string $event, ?string $source = 'server'): void
    {
        if ($this->status === $status) {
            return;
        }
        $this->update(['status' => $status, 'status_changed_at' => now()]);
        ProviderAuthorizationEvent::record($this->user_id, $this->provider, $event, $this->scope, $source);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
