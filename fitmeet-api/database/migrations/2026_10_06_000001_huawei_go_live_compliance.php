<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Huawei Health Kit go-live (App Release Checklist):
//  - provider_connections.status: revoked / insufficient scopes / Health Kit switched off
//    must be detected and shown to the user (checklist 3.3–3.5);
//  - provider_authorization_events: server-side record of every grant/revoke (privacy
//    checklist "Accountability");
//  - users.terms_version: a changed privacy statement needs renewed consent.
// Every step is guarded so a partially applied run on MySQL (DDL auto-commits) can be
// re-run safely — see the 2026-08-23 rider_stopped migration incident.
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('provider_connections', 'status')) {
            Schema::table('provider_connections', function (Blueprint $table) {
                $table->string('status', 24)->default('active');
            });
        }
        if (!Schema::hasColumn('provider_connections', 'status_changed_at')) {
            Schema::table('provider_connections', function (Blueprint $table) {
                $table->timestamp('status_changed_at')->nullable();
            });
        }

        if (!Schema::hasTable('provider_authorization_events')) {
            Schema::create('provider_authorization_events', function (Blueprint $table) {
                $table->id();
                // Kept after account deletion (user_id nulled) so grants/revocations stay traceable.
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('provider', 24);
                $table->string('event', 32);
                $table->text('scope')->nullable();
                $table->string('source', 16)->nullable(); // app | web | server
                $table->timestamp('created_at')->useCurrent();
                $table->index(['user_id', 'provider']);
            });
        }

        if (!Schema::hasColumn('users', 'terms_version')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedSmallInteger('terms_version')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_authorization_events');
        if (Schema::hasColumn('provider_connections', 'status_changed_at')) {
            Schema::table('provider_connections', fn (Blueprint $t) => $t->dropColumn('status_changed_at'));
        }
        if (Schema::hasColumn('provider_connections', 'status')) {
            Schema::table('provider_connections', fn (Blueprint $t) => $t->dropColumn('status'));
        }
        if (Schema::hasColumn('users', 'terms_version')) {
            Schema::table('users', fn (Blueprint $t) => $t->dropColumn('terms_version'));
        }
    }
};
