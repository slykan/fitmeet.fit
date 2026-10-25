<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One logged meal or drink (Health › Food). kcal and macros as estimated by AI or entered by hand. */
class Meal extends Model
{
    protected $fillable = ['user_id', 'eaten_on', 'eaten_at', 'kind', 'description', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'volume_ml', 'source'];

    protected function casts(): array
    {
        return [
            'eaten_on'  => 'date',
            'eaten_at'  => 'datetime',
            'items'     => 'array',
            'kcal'      => 'integer',
            'protein_g' => 'float',
            'carbs_g'   => 'float',
            'fat_g'     => 'float',
            'volume_ml' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
