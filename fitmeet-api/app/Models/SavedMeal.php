<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A meal the user saved under "My meals" to log again with its calories, without a new AI estimate. */
class SavedMeal extends Model
{
    protected $fillable = ['user_id', 'kind', 'description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'volume_ml', 'uses', 'last_used_at'];

    protected function casts(): array
    {
        return [
            'items'        => 'array',
            'kcal'         => 'integer',
            'protein_g'    => 'float',
            'carbs_g'      => 'float',
            'fat_g'        => 'float',
            'volume_ml'    => 'integer',
            'uses'         => 'integer',
            'last_used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
