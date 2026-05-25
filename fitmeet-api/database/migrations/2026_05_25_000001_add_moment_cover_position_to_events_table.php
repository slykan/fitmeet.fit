<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->decimal('moment_cover_x', 5, 4)->nullable()->after('moment_image_path');
            $table->decimal('moment_cover_y', 5, 4)->nullable()->after('moment_cover_x');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['moment_cover_x', 'moment_cover_y']);
        });
    }
};
