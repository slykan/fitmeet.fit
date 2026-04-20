<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category'); // Category enum value

            // Location
            $table->double('lat', 10, 7);
            $table->double('lng', 10, 7);
            $table->string('address')->nullable();

            // Schedule
            $table->dateTime('start_at');
            $table->unsignedSmallInteger('duration_minutes')->nullable();

            // Activity details
            $table->decimal('distance_km', 6, 2)->nullable();
            $table->unsignedSmallInteger('elevation_gain')->nullable(); // meters
            $table->string('pace')->nullable();                         // e.g. "5:30 /km"

            // GPX
            $table->string('gpx_path')->nullable();

            // Settings
            $table->enum('skill_level', ['beginner', 'advanced', 'pro'])->nullable();
            $table->unsignedSmallInteger('max_participants')->nullable(); // null = unlimited
            $table->boolean('is_private')->default(false);

            // State
            $table->enum('status', ['active', 'cancelled', 'completed'])->default('active');

            // Cached counter (avoid COUNT() on every request)
            $table->unsignedSmallInteger('participants_count')->default(0);

            $table->timestamps();

            $table->index(['lat', 'lng']);
            $table->index('start_at');
            $table->index('category');
            $table->index('status');
        });

        Schema::create('event_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['joined', 'cancelled'])->default('joined');
            $table->timestamp('joined_at')->useCurrent();

            $table->unique(['event_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_participants');
        Schema::dropIfExists('events');
    }
};
