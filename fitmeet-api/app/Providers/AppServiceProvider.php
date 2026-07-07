<?php

namespace App\Providers;

use App\Models\Event;
use App\Models\EventComment;
use App\Models\MarketplaceListing;
use App\Models\Message;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            $frontendUrl = rtrim((string) env('FRONTEND_URL', 'https://fitmeet.fit'), '/');

            return $frontendUrl . '/reset-password?token=' . urlencode($token)
                . '&email=' . urlencode((string) $notifiable->getEmailForPasswordReset());
        });

        // Short, stable keys used for polymorphic `reportable_type` values —
        // never trust a raw class name from the client (see ReportController).
        Relation::morphMap([
            'user'    => User::class,
            'event'   => Event::class,
            'comment' => EventComment::class,
            'listing' => MarketplaceListing::class,
            'message' => Message::class,
        ]);
    }
}
