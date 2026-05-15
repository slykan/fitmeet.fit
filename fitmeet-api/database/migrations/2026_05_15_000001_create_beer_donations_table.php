<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beer_donations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('product_id'); // beer_small, beer_medium, beer_large
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beer_donations');
    }
};
