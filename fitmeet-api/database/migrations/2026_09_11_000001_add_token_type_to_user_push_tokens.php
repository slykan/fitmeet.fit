<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_push_tokens', function (Blueprint $table) {
            $table->string('token_type', 16)->default('fcm')->after('platform');
        });
    }

    public function down(): void
    {
        Schema::table('user_push_tokens', function (Blueprint $table) {
            $table->dropColumn('token_type');
        });
    }
};
