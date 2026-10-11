<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // HRR (Karvonen) zones: resting HR + how the saved zones were made (max | hrr | manual).
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('hr_rest')->nullable();
            $table->string('hr_zone_method', 8)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['hr_rest', 'hr_zone_method']);
        });
    }
};
