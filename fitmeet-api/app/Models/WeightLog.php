<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One weigh-in per user per day (from the Health form); the latest also lives on users.weight_kg. */
class WeightLog extends Model
{
    protected $fillable = ['user_id', 'measured_on', 'weight_kg', 'body_fat_pct'];

    protected function casts(): array
    {
        return [
            'measured_on'  => 'date',
            'weight_kg'    => 'float',
            'body_fat_pct' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
