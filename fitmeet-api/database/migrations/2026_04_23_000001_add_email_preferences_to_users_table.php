<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_friend_requests')->default(true)->after('hide_phone');
            $table->boolean('email_new_events')->default(true)->after('email_friend_requests');
            $table->boolean('email_event_reminders')->default(true)->after('email_new_events');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'email_friend_requests',
                'email_new_events',
                'email_event_reminders',
            ]);
        });
    }
};
