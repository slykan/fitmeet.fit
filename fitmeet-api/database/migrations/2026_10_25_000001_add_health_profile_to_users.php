<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Health: inputs for BMR / daily energy and context for the AI coach (own profile only)
            $table->string('sex', 6)->nullable();                 // male | female | na
            $table->decimal('weight_kg', 5, 1)->nullable();
            $table->unsignedSmallInteger('height_cm')->nullable();
            $table->decimal('body_fat_pct', 4, 1)->nullable();
            $table->unsignedInteger('avg_daily_steps')->nullable();
            $table->unsignedSmallInteger('ftp_w')->nullable();
            $table->string('health_goal', 8)->nullable();         // lose | maintain | gain
            $table->decimal('target_weight_kg', 5, 1)->nullable();
            $table->timestamp('health_updated_at')->nullable();
        });

        Schema::create('weight_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('measured_on');
            $table->decimal('weight_kg', 5, 1);
            $table->decimal('body_fat_pct', 4, 1)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'measured_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weight_logs');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['sex', 'weight_kg', 'height_cm', 'body_fat_pct', 'avg_daily_steps', 'ftp_w', 'health_goal', 'target_weight_kg', 'health_updated_at']);
        });
    }
};
