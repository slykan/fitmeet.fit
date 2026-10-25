<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Daily energy snapshot (burned vs eaten); today is refreshed on every view, past days stay frozen. */
class HealthDay extends Model
{
    protected $fillable = ['user_id', 'day', 'bmr_kcal', 'steps_kcal', 'training_kcal', 'food_kcal', 'total_kcal', 'intake_kcal', 'protein_g', 'carbs_g', 'fat_g', 'water_ml', 'trainings', 'weight_kg', 'estimated'];

    protected function casts(): array
    {
        return [
            'day'       => 'date',
            'protein_g' => 'float',
            'carbs_g'   => 'float',
            'fat_g'     => 'float',
            'weight_kg' => 'float',
            'estimated' => 'boolean',
        ];
    }
}
