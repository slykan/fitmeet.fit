<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
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
    }
}
