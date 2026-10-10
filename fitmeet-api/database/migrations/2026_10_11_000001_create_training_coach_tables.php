<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // AI coach analysis of a training — generated once, then reused (no new cost).
        Schema::create('training_coach_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('language', 12);
            $table->string('headline');
            $table->text('summary');
            $table->text('tip')->nullable();
            $table->json('questions');
            $table->json('answers')->nullable(); // [{question, answer, at}]
            $table->string('model');
            $table->timestamps();
        });

        // Every AI call, for the monthly quota and cost tracking.
        Schema::create('coach_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('training_id')->nullable()->constrained()->nullOnDelete();
            $table->string('kind', 16); // analyze | ask
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->index(['user_id', 'kind', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coach_requests');
        Schema::dropIfExists('training_coach_notes');
    }
};
