<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ActivityRouteController;
use App\Http\Controllers\Api\BadgeController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\BeerDonationController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\MomentsController;
use App\Http\Controllers\Api\PaypalController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\EventCommentController;
use App\Http\Controllers\Api\EventWeatherController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserBlockController;
use App\Http\Controllers\Api\AdminReportController;
use App\Http\Controllers\Api\ProviderConnectionController;
use App\Http\Controllers\Api\TrainingController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register',       [AuthController::class, 'register']);
    Route::post('login',          [AuthController::class, 'loginWithEmail']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password',  [AuthController::class, 'resetPassword']);
    Route::get('google',          [AuthController::class, 'redirectToGoogle']);
    Route::get('google/callback', [AuthController::class, 'handleGoogleCallback']);
});

Route::post('strava/login', [\App\Http\Controllers\Api\StravaController::class, 'login']);
Route::get('strava/webhook',  [\App\Http\Controllers\Api\StravaController::class, 'webhookVerify']);
Route::post('strava/webhook', [\App\Http\Controllers\Api\StravaController::class, 'webhookReceive']);

// Turnstile page for mobile WebView
Route::get('turnstile', function () {
    $siteKey = env('TURNSTILE_SITE_KEY', '0x4AAAAAAA272FNBOuqwbiqe');
    return response('<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    body{
      background:#050816;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:12px;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    .wrap{
      width:100%;
      max-width:320px;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .cf-turnstile{
      width:100%;
      min-height:65px;
    }
    iframe{
      max-width:100%;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="cf-turnstile" data-sitekey="' . $siteKey . '" data-callback="onSuccess" data-theme="dark" data-size="flexible"></div>
  </div>
  <script>function onSuccess(t){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"token",token:t}))}</script>
</body>
</html>', 200, ['Content-Type' => 'text/html', 'X-Frame-Options' => 'ALLOWALL']);
});

// Public
Route::get('categories', [CategoryController::class, 'index']);
Route::get('beer-donations', [BeerDonationController::class, 'index']);
Route::get('leaderboard', [LeaderboardController::class, 'index']);
Route::get('moments',    [MomentsController::class,   'index']);
Route::get('users/public-latest', [UserController::class, 'publicLatest']);
Route::get('comments/public-latest', [EventCommentController::class, 'publicLatest']);
Route::get('users/public-stats',  [UserController::class, 'publicStats']);
Route::get('events/public/{event}',   [EventController::class, 'publicShow']);
Route::get('events/public/{event}/gpx', [EventController::class, 'publicGpx']);
Route::get('events/public-latest',    [EventController::class, 'publicLatest']);
Route::get('market/public-latest',    [MarketplaceController::class, 'publicLatest']);
Route::get('market/public/{listing}', [MarketplaceController::class, 'publicShow']);
Route::get('routes', [ActivityRouteController::class, 'index']);
Route::get('routes/{activityRoute}', [ActivityRouteController::class, 'show']);
Route::get('routes/{activityRoute}/gpx', [ActivityRouteController::class, 'gpx']);
Route::post('auth/register-mobile',   [AuthController::class, 'registerMobile']);
Route::post('auth/login-mobile',      [AuthController::class, 'loginMobile']);
Route::post('auth/google-mobile',     [AuthController::class, 'googleMobile']);
Route::post('auth/apple-mobile',      [AuthController::class, 'appleMobile']);
Route::get('events/og',            [EventController::class, 'ogPage']);
Route::get('market/og',            [MarketplaceController::class, 'ogPage']);

// Protected routes
Route::middleware(['auth:sanctum', \App\Http\Middleware\EnsureNotBanned::class])->group(function () {
    Route::get('me',          [AuthController::class, 'me']);
    Route::get('me/stats',    [UserController::class, 'myStats']);
    Route::patch('me',        [UserController::class, 'update']);
    Route::delete('me',       [AuthController::class, 'destroyAccount']);
    Route::post('me/avatar',  [UserController::class, 'updateAvatar']);
    Route::post('me/push-token', [UserController::class, 'upsertPushToken']);
    Route::post('me/invite-tap', [UserController::class, 'recordInviteTap']);
    Route::delete('me/push-token', [UserController::class, 'destroyPushToken']);
    Route::get('users', [UserController::class, 'index']);
    Route::get('users/{user}', [UserController::class, 'show']);
    Route::get('badges', [BadgeController::class, 'index']);

    // Reporting & blocking (Apple guideline 1.2)
    Route::post('reports', [ReportController::class, 'store']);
    Route::get('blocks', [UserBlockController::class, 'index']);
    Route::post('blocks/{user}', [UserBlockController::class, 'store']);
    Route::delete('blocks/{user}', [UserBlockController::class, 'destroy']);

    // Friends & notifications
    Route::post('strava/token',                    [\App\Http\Controllers\Api\StravaController::class, 'exchangeToken']);
    Route::post('strava/routes',                   [\App\Http\Controllers\Api\StravaController::class, 'routes']);
    Route::post('strava/routes/{routeId}/gpx',     [\App\Http\Controllers\Api\StravaController::class, 'routeGpx']);
    Route::post('strava/connect',                  [\App\Http\Controllers\Api\StravaController::class, 'connect']);
    Route::delete('strava/connect',                [\App\Http\Controllers\Api\StravaController::class, 'disconnect']);
    Route::post('strava/resync',                   [\App\Http\Controllers\Api\StravaController::class, 'resync']);

    // Trainings (Strava/Garmin/Huawei sync)
    Route::get('connections', [ProviderConnectionController::class, 'index']);
    Route::post('connections/reorder', [ProviderConnectionController::class, 'reorder']);
    Route::get('trainings', [TrainingController::class, 'index']);
    Route::get('notifications/count',              [FriendController::class, 'notificationsCount']);
    Route::delete('notifications/clear-all',       [FriendController::class, 'notificationsClearAll']);
    Route::post('notifications/read',              [FriendController::class, 'notificationsMarkRead']);
    Route::get('notifications',                   [FriendController::class, 'notifications']);
    Route::post('friends/request/{user}',         [FriendController::class, 'request']);
    Route::post('friends/accept/{friendRequest}',   [FriendController::class, 'accept']);
    Route::post('friends/decline/{friendRequest}',  [FriendController::class, 'decline']);
    Route::delete('friends/cancel/{user}',          [FriendController::class, 'cancel']);
    Route::delete('friends/{user}',                 [FriendController::class, 'remove']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('beer-donations', [BeerDonationController::class, 'store']);
    Route::post('paypal/create-order', [PaypalController::class, 'createOrder']);
    Route::post('paypal/capture-order', [PaypalController::class, 'captureOrder']);

    // Messages
    Route::get('messages/unread-count',  [MessageController::class, 'unreadCount']);
    Route::post('messages/conversations', [MessageController::class, 'createConversation']);
    Route::get('messages/conversations/{conversation}', [MessageController::class, 'conversationThread']);
    Route::post('messages/conversations/{conversation}', [MessageController::class, 'sendToConversation']);
    Route::post('messages/conversations/{conversation}/participants', [MessageController::class, 'addParticipants']);
    Route::delete('messages/conversations/{conversation}/participants/{user}', [MessageController::class, 'removeParticipant']);
    Route::delete('messages/conversations/{conversation}', [MessageController::class, 'destroyConversation']);
    Route::get('messages/{user}',        [MessageController::class, 'thread']);
    Route::post('messages/{user}',       [MessageController::class, 'send']);
    Route::delete('messages/{user}',     [MessageController::class, 'destroy']);
    Route::get('messages',               [MessageController::class, 'index']);

    // Events
    Route::get('events/my', [EventController::class, 'my']);
    Route::get('events/joined', [EventController::class, 'joined']);
    Route::get('events/my-reminders', [EventController::class, 'myReminders']);
    Route::post('events/weather-snapshots', [EventWeatherController::class, 'snapshots']);
    Route::get('events/{event}/gpx', [EventController::class, 'gpx']);
    Route::get('events/{event}/comments', [EventCommentController::class, 'index']);
    Route::post('events/{event}/comments', [EventCommentController::class, 'store']);
    Route::delete('events/{event}/comments/{comment}', [EventCommentController::class, 'destroy']);
    Route::post('events/{event}/join', [EventController::class, 'join']);
    Route::post('events/{event}/leave', [EventController::class, 'leave']);
    Route::post('events/{event}/remind', [EventController::class, 'setReminders']);
    Route::post('events/{event}/join-notifications', [EventController::class, 'setJoinNotifications']);
    Route::post('events/{event}/check-in', [EventController::class, 'checkIn']);
    Route::post('events/{event}/moment', [EventController::class, 'storeMoment']);
    Route::apiResource('events', EventController::class);

    Route::get('me/routes', [ActivityRouteController::class, 'my']);
    Route::post('routes', [ActivityRouteController::class, 'store']);
    Route::put('routes/{activityRoute}', [ActivityRouteController::class, 'update']);
    Route::delete('routes/{activityRoute}', [ActivityRouteController::class, 'destroy']);

    Route::get('market', [MarketplaceController::class, 'index']);
    Route::get('market/my', [MarketplaceController::class, 'my']);
    Route::get('market/saved', [MarketplaceController::class, 'saved']);
    Route::get('market/{listing}', [MarketplaceController::class, 'show']);
    Route::post('market', [MarketplaceController::class, 'store']);
    Route::post('market/{listing}', [MarketplaceController::class, 'update']);
    Route::put('market/{listing}', [MarketplaceController::class, 'update']);
    Route::post('market/{listing}/save', [MarketplaceController::class, 'toggleSave']);
    Route::post('market/{listing}/sold', [MarketplaceController::class, 'markSold']);
    Route::delete('market/{listing}', [MarketplaceController::class, 'destroy']);

    Route::middleware(\App\Http\Middleware\EnsureAdmin::class)->prefix('admin')->group(function () {
        Route::get('broadcasts', [AdminController::class, 'broadcasts']);
        Route::post('broadcast', [AdminController::class, 'broadcast']);
        Route::get('countries', [AdminController::class, 'countries']);
        Route::get('reports', [AdminReportController::class, 'index']);
        Route::post('reports/{report}/resolve', [AdminReportController::class, 'resolve']);
    });
});
