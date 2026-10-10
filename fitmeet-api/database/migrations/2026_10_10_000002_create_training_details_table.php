<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Full provider detail for a training (Strava for now): splits, laps, best
        // efforts, power/cadence… and downsampled streams for the charts. Shown only
        // to the training's owner (Strava API terms: no display to other users).
        Schema::create('training_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('details')->nullable();
            $table->json('streams')->nullable();
            $table->timestamp('details_fetched_at')->nullable();
            $table->timestamp('streams_fetched_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_details');
    }
};
