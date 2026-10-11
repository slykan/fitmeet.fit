<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Personal heart-rate zones: a max HR (zones = 50/60/70/80/90 %) or five manual
        // lower bounds in bpm. Without either, 220 − age / the highest HR seen is used.
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('hr_max')->nullable();
            $table->json('hr_zones')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['hr_max', 'hr_zones']);
        });
    }
};
