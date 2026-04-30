<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'push_notifications')) {
                $table->boolean('push_notifications')->default(true)->after('email_friend_events');
            }
        });

        Schema::create('user_push_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('platform', 24)->nullable();
            $table->string('device_name', 120)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        if (Schema::hasColumn('users', 'fcm_token')) {
            $now = now();
            $rows = DB::table('users')
                ->whereNotNull('fcm_token')
                ->select('id', 'fcm_token')
                ->get()
                ->map(fn ($user) => [
                    'user_id' => $user->id,
                    'token' => $user->fcm_token,
                    'platform' => 'android',
                    'device_name' => null,
                    'last_seen_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->all();

            if (! empty($rows)) {
                DB::table('user_push_tokens')->insertOrIgnore($rows);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_push_tokens');

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'push_notifications')) {
                $table->dropColumn('push_notifications');
            }
        });
    }
};
