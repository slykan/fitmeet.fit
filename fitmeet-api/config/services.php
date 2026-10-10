<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect'      => env('GOOGLE_REDIRECT_URI'),
    ],

    'turnstile' => [
        'secret' => env('TURNSTILE_SECRET'),
    ],

    'strava' => [
        'client_id'            => env('STRAVA_CLIENT_ID'),
        'client_secret'        => env('STRAVA_CLIENT_SECRET'),
        'webhook_verify_token' => env('STRAVA_WEBHOOK_VERIFY_TOKEN'),
    ],

    // AI coach (training analysis). One server-side key — users connect nothing.
    'anthropic' => [
        // The production .env is immutable (root-only), so the key can also live in
        // storage/app/private/anthropic.key (chmod 600, not in git).
        'api_key'                 => env('ANTHROPIC_API_KEY') ?: (is_readable($anthropicKeyFile = storage_path('app/private/anthropic.key'))
            ? trim((string) file_get_contents($anthropicKeyFile)) : null),
        'coach_model'             => env('COACH_MODEL', 'claude-opus-5-5'),
        'coach_monthly_analyses'  => (int) env('COACH_MONTHLY_ANALYSES', 10),
        'coach_monthly_questions' => (int) env('COACH_MONTHLY_QUESTIONS', 20),
    ],

    'huawei' => [
        'client_id'     => env('HUAWEI_CLIENT_ID'),
        'client_secret' => env('HUAWEI_CLIENT_SECRET'),
        'redirect_uri'  => env('HUAWEI_REDIRECT_URI', 'https://fitmeet.fit/huawei-callback'),
    ],

];
