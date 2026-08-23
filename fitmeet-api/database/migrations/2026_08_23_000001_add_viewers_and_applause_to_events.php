<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('last_applause_at')->nullable()->after('link_url');
        });

        Schema::table('event_participants', function (Blueprint $table) {
            $table->timestamp('viewer_last_seen_at')->nullable()->after('live_updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('last_applause_at');
        });

        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn('viewer_last_seen_at');
        });
    }
};
