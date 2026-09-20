<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->foreignId('reversed_from_route_id')->nullable()->after('source_event_id')->constrained('routes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reversed_from_route_id');
        });
    }
};
