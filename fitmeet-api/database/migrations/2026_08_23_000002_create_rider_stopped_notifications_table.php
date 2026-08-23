<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_stopped_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stopped_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'event_id', 'stopped_user_id']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::table('event_participants', function (Blueprint $table) {
            $table->double('stopped_anchor_lat')->nullable()->after('viewer_last_seen_at');
            $table->double('stopped_anchor_lng')->nullable()->after('stopped_anchor_lat');
            $table->timestamp('stopped_anchor_at')->nullable()->after('stopped_anchor_lng');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_stopped_notifications');

        Schema::table('event_participants', function (Blueprint $table) {
            $table->dropColumn(['stopped_anchor_lat', 'stopped_anchor_lng', 'stopped_anchor_at']);
        });
    }
};
