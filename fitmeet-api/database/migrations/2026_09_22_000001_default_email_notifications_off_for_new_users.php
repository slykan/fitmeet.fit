<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_friend_requests')->default(false)->change();
            $table->boolean('email_new_events')->default(false)->change();
            $table->boolean('email_event_reminders')->default(false)->change();
            $table->boolean('email_friend_events')->default(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_friend_requests')->default(true)->change();
            $table->boolean('email_new_events')->default(true)->change();
            $table->boolean('email_event_reminders')->default(true)->change();
            $table->boolean('email_friend_events')->default(true)->change();
        });
    }
};
