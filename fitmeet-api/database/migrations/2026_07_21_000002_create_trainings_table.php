<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trainings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('external_id');
            $table->string('category');
            $table->string('raw_type')->nullable();
            $table->string('name')->nullable();
            $table->timestamp('started_at');
            $table->unsignedInteger('duration_s')->nullable();
            $table->double('distance_m')->nullable();
            $table->float('elevation_gain')->nullable();
            $table->uuid('dedup_group_id')->nullable();
            $table->boolean('is_primary')->default(true);
            $table->timestamps();

            $table->unique(['provider', 'external_id']);
            $table->index(['user_id', 'started_at']);
            $table->index('dedup_group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trainings');
    }
};
