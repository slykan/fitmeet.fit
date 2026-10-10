<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // AI weekly report over the last 7 days, kept so reopening it costs nothing.
        Schema::create('weekly_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('language', 12);
            $table->string('headline');
            $table->text('summary');
            $table->json('plan');
            $table->json('questions');
            $table->json('answers')->nullable();
            // trainings included — newer ones make the report "stale" (refresh offered)
            $table->unsignedInteger('trainings_count');
            $table->timestamp('last_training_at')->nullable();
            $table->string('model');
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_reports');
    }
};
