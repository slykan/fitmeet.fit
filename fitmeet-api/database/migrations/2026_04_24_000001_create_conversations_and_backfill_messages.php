<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('conversations')) {
            Schema::create('conversations', function (Blueprint $table) {
                $table->id();
                $table->boolean('is_group')->default(false);
                $table->string('title')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['is_group', 'created_at']);
            });
        }

        if (! Schema::hasTable('conversation_participants')) {
            Schema::create('conversation_participants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->timestamp('last_read_at')->nullable();
                $table->timestamps();

                $table->unique(['conversation_id', 'user_id']);
                $table->index(['user_id', 'last_read_at']);
            });
        }

        if (! Schema::hasColumn('messages', 'conversation_id')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->foreignId('conversation_id')->nullable()->after('id')->constrained()->nullOnDelete();
                $table->index(['conversation_id', 'created_at']);
            });
        }

        $pairs = DB::table('messages')
            ->selectRaw('LEAST(sender_id, receiver_id) as user_one')
            ->selectRaw('GREATEST(sender_id, receiver_id) as user_two')
            ->whereNull('conversation_id')
            ->groupByRaw('LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)')
            ->get();

        foreach ($pairs as $pair) {
            $firstMessage = DB::table('messages')
                ->whereNull('conversation_id')
                ->where(function ($query) use ($pair) {
                    $query
                        ->where(function ($inner) use ($pair) {
                            $inner
                                ->where('sender_id', $pair->user_one)
                                ->where('receiver_id', $pair->user_two);
                        })
                        ->orWhere(function ($inner) use ($pair) {
                            $inner
                                ->where('sender_id', $pair->user_two)
                                ->where('receiver_id', $pair->user_one);
                        });
                })
                ->orderBy('id')
                ->first();

            if (! $firstMessage) {
                continue;
            }

            $conversationId = DB::table('conversations')->insertGetId([
                'is_group'   => false,
                'title'      => null,
                'created_by' => $firstMessage->sender_id,
                'created_at' => $firstMessage->created_at,
                'updated_at' => $firstMessage->updated_at,
            ]);

            DB::table('messages')
                ->whereNull('conversation_id')
                ->where(function ($query) use ($pair) {
                    $query
                        ->where(function ($inner) use ($pair) {
                            $inner
                                ->where('sender_id', $pair->user_one)
                                ->where('receiver_id', $pair->user_two);
                        })
                        ->orWhere(function ($inner) use ($pair) {
                            $inner
                                ->where('sender_id', $pair->user_two)
                                ->where('receiver_id', $pair->user_one);
                        });
                })
                ->update(['conversation_id' => $conversationId]);

            foreach ([$pair->user_one, $pair->user_two] as $userId) {
                $lastReadAt = DB::table('messages')
                    ->where('conversation_id', $conversationId)
                    ->where(function ($query) use ($userId) {
                        $query
                            ->where('sender_id', $userId)
                            ->orWhere(function ($inner) use ($userId) {
                                $inner->where('receiver_id', $userId)->whereNotNull('read_at');
                            });
                    })
                    ->max(DB::raw('COALESCE(read_at, created_at)'));

                DB::table('conversation_participants')->updateOrInsert(
                    ['conversation_id' => $conversationId, 'user_id' => $userId],
                    [
                        'last_read_at' => $lastReadAt,
                        'created_at'   => $firstMessage->created_at,
                        'updated_at'   => now(),
                    ]
                );
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('messages', 'conversation_id')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropConstrainedForeignId('conversation_id');
            });
        }

        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};
