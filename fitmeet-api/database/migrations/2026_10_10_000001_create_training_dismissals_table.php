<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Trainings the user deleted by hand: the provider sync skips these so a deleted
        // Huawei/Strava training doesn't come straight back on the next poll.
        Schema::create('training_dismissals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('external_id');
            $table->timestamp('created_at')->nullable();

            $table->unique(['provider', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('training_dismissals');
    }
};
