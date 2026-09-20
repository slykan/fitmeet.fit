<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            // Device-captured GPS fix time (epoch ms), distinct from live_updated_at
            // (server receipt time) -- lets updateLocation() reject a fix that was
            // captured earlier but arrives later over the network.
            $table->unsignedBigInteger('live_fix_at_ms')->nullable()->after('live_updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn('live_fix_at_ms');
        });
    }
};
