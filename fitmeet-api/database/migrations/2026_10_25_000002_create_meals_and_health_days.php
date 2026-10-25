<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Food log: one row per meal or drink, by day (app timezone)
        Schema::create('meals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('eaten_on');
            $table->dateTime('eaten_at');
            $table->string('kind', 8)->default('meal');      // meal | drink
            $table->string('description', 500);
            $table->json('items')->nullable();                // [{name, kcal, protein_g, carbs_g, fat_g}]
            $table->unsignedSmallInteger('kcal');
            $table->decimal('protein_g', 5, 1)->default(0);
            $table->decimal('carbs_g', 5, 1)->default(0);
            $table->decimal('fat_g', 5, 1)->default(0);
            $table->unsignedSmallInteger('volume_ml')->nullable(); // drinks (water counts for hydration)
            $table->string('source', 8)->default('ai');       // ai | repeat | quick | manual
            $table->timestamps();
            $table->index(['user_id', 'eaten_on']);
        });

        // Daily energy snapshot: past days stay as they were even when weight etc. change later
        Schema::create('health_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->unsignedSmallInteger('bmr_kcal');
            $table->unsignedSmallInteger('steps_kcal')->default(0);
            $table->unsignedSmallInteger('training_kcal')->default(0);
            $table->unsignedSmallInteger('food_kcal')->default(0);     // thermic effect of food
            $table->unsignedSmallInteger('total_kcal');
            $table->unsignedSmallInteger('intake_kcal')->default(0);
            $table->decimal('protein_g', 6, 1)->default(0);
            $table->decimal('carbs_g', 6, 1)->default(0);
            $table->decimal('fat_g', 6, 1)->default(0);
            $table->unsignedSmallInteger('water_ml')->default(0);
            $table->unsignedTinyInteger('trainings')->default(0);
            $table->decimal('weight_kg', 5, 1)->nullable();
            $table->boolean('estimated')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_days');
        Schema::dropIfExists('meals');
    }
};
