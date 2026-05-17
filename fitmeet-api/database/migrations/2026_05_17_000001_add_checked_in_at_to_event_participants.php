<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            $table->timestamp('checked_in_at')->nullable()->after('notify_on_join');
        });
    }

    public function down(): void
    {
        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn('checked_in_at');
        });
    }
};
