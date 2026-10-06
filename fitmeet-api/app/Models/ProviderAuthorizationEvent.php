<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Server-side trail of every data-provider authorization change (granted, revoked in
// FitMeet, revoked/switched off on the provider side, insufficient scopes). Required by
// Huawei Health Kit's privacy checklist ("Accountability") and shown in the data export.
class ProviderAuthorizationEvent extends Model
{
    public const UPDATED_AT = null;

    public const GRANTED              = 'granted';
    public const INSUFFICIENT_SCOPE   = 'insufficient_scope';
    public const REVOKED_IN_APP       = 'revoked_in_app';
    public const REVOKED_BY_PROVIDER  = 'revoked_by_provider';
    public const PROVIDER_UNAVAILABLE = 'provider_unavailable';

    protected $fillable = ['user_id', 'provider', 'event', 'scope', 'source'];

    public static function record(?int $userId, string $provider, string $event, ?string $scope = null, ?string $source = null): void
    {
        static::create([
            'user_id'  => $userId,
            'provider' => $provider,
            'event'    => $event,
            'scope'    => $scope,
            'source'   => $source,
        ]);
    }
}
