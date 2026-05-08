<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\EventCommentController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register',       [AuthController::class, 'register']);
    Route::post('login',          [AuthController::class, 'loginWithEmail']);
    Route::get('google',          [AuthController::class, 'redirectToGoogle']);
    Route::get('google/callback', [AuthController::class, 'handleGoogleCallback']);
});

Route::post('strava/login', [\App\Http\Controllers\Api\StravaController::class, 'login']);

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
Route::get('events/public/{event}',   [EventController::class, 'publicShow']);
Route::get('events/public-latest',    [EventController::class, 'publicLatest']);
Route::post('auth/register-mobile',   [AuthController::class, 'registerMobile']);
Route::post('auth/login-mobile',      [AuthController::class, 'loginMobile']);
Route::post('auth/google-mobile',     [AuthController::class, 'googleMobile']);
Route::get('events/og',            [EventController::class, 'ogPage']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me',          [AuthController::class, 'me']);
    Route::patch('me',        [UserController::class, 'update']);
    Route::delete('me',       [AuthController::class, 'destroyAccount']);
    Route::post('me/avatar',  [UserController::class, 'updateAvatar']);
    Route::post('me/push-token', [UserController::class, 'upsertPushToken']);
    Route::delete('me/push-token', [UserController::class, 'destroyPushToken']);
    Route::get('users', [UserController::class, 'index']);

    // Friends & notifications
    Route::post('strava/token',                    [\App\Http\Controllers\Api\StravaController::class, 'exchangeToken']);
    Route::post('strava/routes',                   [\App\Http\Controllers\Api\StravaController::class, 'routes']);
    Route::post('strava/routes/{routeId}/gpx',     [\App\Http\Controllers\Api\StravaController::class, 'routeGpx']);
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
    Route::get('events/{event}/gpx', [EventController::class, 'gpx']);
    Route::get('events/{event}/comments', [EventCommentController::class, 'index']);
    Route::post('events/{event}/comments', [EventCommentController::class, 'store']);
    Route::delete('events/{event}/comments/{comment}', [EventCommentController::class, 'destroy']);
    Route::post('events/{event}/join', [EventController::class, 'join']);
    Route::post('events/{event}/leave', [EventController::class, 'leave']);
    Route::post('events/{event}/remind', [EventController::class, 'setReminders']);
    Route::apiResource('events', EventController::class);
});
