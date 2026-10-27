<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // "My meals": meals the user saved with their calories, offered again in the Add meal sheet (no AI call)
        Schema::create('saved_meals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 8)->default('meal');      // meal | drink
            $table->string('description', 500);
            $table->json('items')->nullable();
            $table->unsignedSmallInteger('kcal');
            $table->decimal('protein_g', 5, 1)->default(0);
            $table->decimal('carbs_g', 5, 1)->default(0);
            $table->decimal('fat_g', 5, 1)->default(0);
            $table->unsignedSmallInteger('volume_ml')->nullable();
            $table->unsignedInteger('uses')->default(0);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'uses']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_meals');
    }
};
