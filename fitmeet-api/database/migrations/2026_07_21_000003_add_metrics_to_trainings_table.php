<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->float('avg_heartrate')->nullable()->after('elevation_gain');
            $table->float('max_heartrate')->nullable()->after('avg_heartrate');
            $table->float('avg_watts')->nullable()->after('max_heartrate');
            $table->float('max_watts')->nullable()->after('avg_watts');
            $table->float('avg_cadence')->nullable()->after('max_watts');
            $table->float('calories')->nullable()->after('avg_cadence');
        });
    }

    public function down(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->dropColumn(['avg_heartrate', 'max_heartrate', 'avg_watts', 'max_watts', 'avg_cadence', 'calories']);
        });
    }
};
