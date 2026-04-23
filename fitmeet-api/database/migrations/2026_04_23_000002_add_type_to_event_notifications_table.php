<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_notifications', function (Blueprint $table) {
            $table->string('type')->default('new_event')->after('event_id');
        });

        DB::table('event_notifications')->update(['type' => 'new_event']);

        Schema::table('event_notifications', function (Blueprint $table) {
            $table->dropUnique('event_notifications_user_id_event_id_unique');
            $table->unique(['user_id', 'event_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::table('event_notifications', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'event_id', 'type']);
            $table->unique(['user_id', 'event_id']);
            $table->dropColumn('type');
        });
    }
};
