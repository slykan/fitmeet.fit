<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('event_notifications', 'type')) {
            Schema::table('event_notifications', function (Blueprint $table) {
                $table->string('type')->default('new_event')->after('event_id');
            });
        }

        DB::table('event_notifications')->whereNull('type')->update(['type' => 'new_event']);

        try {
            DB::statement('ALTER TABLE event_notifications ADD INDEX event_notifications_user_id_index (user_id)');
        } catch (\Throwable) {
        }

        try {
            DB::statement('ALTER TABLE event_notifications ADD INDEX event_notifications_event_id_index (event_id)');
        } catch (\Throwable) {
        }

        try {
            DB::statement('ALTER TABLE event_notifications DROP INDEX event_notifications_user_id_event_id_unique');
        } catch (\Throwable) {
        }

        try {
            DB::statement('ALTER TABLE event_notifications ADD UNIQUE event_notifications_user_id_event_id_type_unique (user_id, event_id, type)');
        } catch (\Throwable) {
        }
    }

    public function down(): void
    {
        Schema::table('event_notifications', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'event_id', 'type']);
            $table->dropIndex(['user_id']);
            $table->dropIndex(['event_id']);
            $table->unique(['user_id', 'event_id']);
            $table->dropColumn('type');
        });
    }
};
