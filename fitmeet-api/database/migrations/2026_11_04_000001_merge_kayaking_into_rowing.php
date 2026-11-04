<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Kayaking is folded into Rowing (one paddle/oar category). Moves every stored
// 'kayaking' to 'rowing'; the enum keeps the old case only so older apps that
// still send it don't fail validation (see Category::normalize()).
return new class extends Migration
{
    public function up(): void
    {
        foreach (['events', 'routes', 'marketplace_listings', 'trainings'] as $table) {
            DB::table($table)->where('category', 'kayaking')->update(['category' => 'rowing']);
        }

        DB::table('users')->where('categories', 'like', '%"kayaking"%')->orderBy('id')
            ->each(function ($user) {
                $categories = json_decode($user->categories, true) ?: [];
                $categories = array_values(array_unique(array_map(
                    fn ($c) => $c === 'kayaking' ? 'rowing' : $c,
                    $categories,
                )));
                DB::table('users')->where('id', $user->id)->update(['categories' => json_encode($categories)]);
            });
    }

    public function down(): void
    {
        // not reversible: rowing and former kayaking entries can't be told apart
    }
};
