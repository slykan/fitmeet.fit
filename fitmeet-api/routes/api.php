<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\EventController;
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

// Public
Route::get('categories', [CategoryController::class, 'index']);
Route::get('events/public/{event}', [EventController::class, 'publicShow']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::patch('me', [UserController::class, 'update']);
    Route::get('users', [UserController::class, 'index']);

    // Friends & notifications
    Route::get('notifications',                   [FriendController::class, 'notifications']);
    Route::post('friends/request/{user}',         [FriendController::class, 'request']);
    Route::post('friends/accept/{friendRequest}',   [FriendController::class, 'accept']);
    Route::post('friends/decline/{friendRequest}',  [FriendController::class, 'decline']);
    Route::delete('friends/cancel/{user}',          [FriendController::class, 'cancel']);
    Route::delete('friends/{user}',                 [FriendController::class, 'remove']);
    Route::post('logout', [AuthController::class, 'logout']);

    // Messages
    Route::get('messages/unread-count',  [MessageController::class, 'unreadCount']);
    Route::get('messages/{user}',        [MessageController::class, 'thread']);
    Route::post('messages/{user}',       [MessageController::class, 'send']);
    Route::delete('messages/{user}',     [MessageController::class, 'destroy']);
    Route::get('messages',               [MessageController::class, 'index']);

    // Events
    Route::get('events/my', [EventController::class, 'my']);
    Route::get('events/joined', [EventController::class, 'joined']);
    Route::get('events/my-reminders', [EventController::class, 'myReminders']);
    Route::get('events/{event}/gpx', [EventController::class, 'gpx']);
    Route::post('events/{event}/join', [EventController::class, 'join']);
    Route::post('events/{event}/leave', [EventController::class, 'leave']);
    Route::post('events/{event}/remind', [EventController::class, 'setReminders']);
    Route::apiResource('events', EventController::class);
});
