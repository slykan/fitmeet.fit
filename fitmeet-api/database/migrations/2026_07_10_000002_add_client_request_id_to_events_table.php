<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('client_request_id')->nullable()->after('user_id');
            $table->unique(['user_id', 'client_request_id']);
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'client_request_id']);
            $table->dropColumn('client_request_id');
        });
    }
};
