<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Active location (auto-detected or manually set)
            $table->double('lat', 10, 7)->nullable()->after('city');
            $table->double('lng', 10, 7)->nullable()->after('lat');

            // Home location (permanent residence)
            $table->double('home_lat', 10, 7)->nullable()->after('lng');
            $table->double('home_lng', 10, 7)->nullable()->after('home_lat');
            $table->string('home_city')->nullable()->after('home_lng');
            $table->string('home_country')->nullable()->after('home_city');

            // Replace integer radius with enum ranges
            $table->dropColumn('radius');
            $table->enum('radius', ['nearby', 'city', 'region', 'unlimited'])->default('nearby')->after('home_country');

            // Event category preferences (JSON array)
            $table->json('categories')->nullable()->after('radius');

            // Skill level
            $table->enum('skill_level', ['beginner', 'advanced', 'pro'])->nullable()->after('categories');

            // FCM token for push notifications
            $table->string('fcm_token')->nullable()->after('skill_level');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng', 'home_lat', 'home_lng', 'home_city', 'home_country', 'radius', 'categories', 'skill_level', 'fcm_token']);
            $table->unsignedInteger('radius')->default(10);
        });
    }
};
