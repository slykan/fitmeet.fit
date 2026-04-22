<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\EventController;
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

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::patch('me', [UserController::class, 'update']);
    Route::get('users', [UserController::class, 'index']);
    Route::post('logout', [AuthController::class, 'logout']);

    // Events
    Route::get('events/my', [EventController::class, 'my']);
    Route::get('events/joined', [EventController::class, 'joined']);
    Route::get('events/{event}/gpx', [EventController::class, 'gpx']);
    Route::post('events/{event}/join', [EventController::class, 'join']);
    Route::post('events/{event}/leave', [EventController::class, 'leave']);
    Route::apiResource('events', EventController::class);
});
