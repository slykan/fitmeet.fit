<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            $table->boolean('live_sharing_enabled')->default(false)->after('checked_in_at');
            $table->double('live_lat')->nullable()->after('live_sharing_enabled');
            $table->double('live_lng')->nullable()->after('live_lat');
            $table->double('live_speed_kmh')->nullable()->after('live_lng');
            $table->timestamp('live_updated_at')->nullable()->after('live_speed_kmh');
        });
    }

    public function down(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn(['live_sharing_enabled', 'live_lat', 'live_lng', 'live_speed_kmh', 'live_updated_at']);
        });
    }
};
