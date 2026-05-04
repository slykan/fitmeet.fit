<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('event_notifications', 'read_at')) {
            Schema::table('event_notifications', function (Blueprint $table) {
                $table->timestamp('read_at')->nullable()->after('type')->index();
            });
        }

        if (! Schema::hasColumn('event_reminders', 'read_at')) {
            Schema::table('event_reminders', function (Blueprint $table) {
                $table->timestamp('read_at')->nullable()->after('sent_at')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('event_notifications', 'read_at')) {
            Schema::table('event_notifications', function (Blueprint $table) {
                $table->dropColumn('read_at');
            });
        }

        if (Schema::hasColumn('event_reminders', 'read_at')) {
            Schema::table('event_reminders', function (Blueprint $table) {
                $table->dropColumn('read_at');
            });
        }
    }
};
