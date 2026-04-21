<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->decimal('max_grade',     5, 1)->nullable()->after('pace'); // % steepest uphill
            $table->decimal('max_downgrade', 5, 1)->nullable()->after('max_grade'); // % steepest downhill (negative)
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('max_grade');
        });
    }
};
