<?php

use App\Enums\Category;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_event_id')->nullable()->constrained('events')->nullOnDelete();
            $table->string('title', 140);
            $table->string('category', 40)->default(Category::Other->value);
            $table->decimal('distance_km', 7, 2)->nullable();
            $table->unsignedInteger('elevation_gain')->nullable();
            $table->decimal('max_grade', 5, 1)->nullable();
            $table->decimal('max_downgrade', 5, 1)->nullable();
            $table->decimal('start_lat', 10, 7)->nullable();
            $table->decimal('start_lng', 10, 7)->nullable();
            $table->decimal('end_lat', 10, 7)->nullable();
            $table->decimal('end_lng', 10, 7)->nullable();
            $table->string('area_label')->nullable();
            $table->string('surface_type', 40)->nullable();
            $table->string('gpx_path');
            $table->boolean('is_public')->default(true);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamps();

            $table->index(['is_public', 'category']);
            $table->index(['distance_km', 'elevation_gain']);
            $table->index(['start_lat', 'start_lng']);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->foreignId('route_id')->nullable()->after('gpx_path')->constrained('routes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('route_id');
        });

        Schema::dropIfExists('routes');
    }
};
