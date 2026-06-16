<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_listings', function (Blueprint $table) {
            $table->unsignedInteger('views_count')->default(0)->after('status');
        });

        Schema::create('marketplace_listing_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('listing_id')->constrained('marketplace_listings')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'listing_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_listing_saves');
        Schema::table('marketplace_listings', function (Blueprint $table) {
            $table->dropColumn('views_count');
        });
    }
};
