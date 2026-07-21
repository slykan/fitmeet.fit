<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->float('avg_speed_mps')->nullable()->after('calories');
            $table->float('max_speed_mps')->nullable()->after('avg_speed_mps');
            $table->float('kilojoules')->nullable()->after('max_speed_mps');
            $table->float('suffer_score')->nullable()->after('kilojoules');
        });
    }

    public function down(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->dropColumn(['avg_speed_mps', 'max_speed_mps', 'kilojoules', 'suffer_score']);
        });
    }
};
