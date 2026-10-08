<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('auto_check_in')->default(false)->after('auto_share_live_location');
        });

        // Automatic check-in: the app reports arriving at the meeting point; arriving
        // before check-in opens is remembered here and checked in when it opens.
        Schema::table('event_participants', function (Blueprint $table) {
            $table->timestamp('present_at')->nullable()->after('checked_in_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('auto_check_in');
        });
        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn('present_at');
        });
    }
};
