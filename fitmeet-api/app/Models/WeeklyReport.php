<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeeklyReport extends Model
{
    protected $fillable = [
        'user_id', 'kind', 'period_start', 'period_end', 'language', 'headline', 'summary', 'plan',
        'questions', 'answers', 'trainings_count', 'last_training_at', 'model',
    ];

    protected function casts(): array
    {
        return [
            'period_start'     => 'date',
            'period_end'       => 'date',
            'plan'             => 'array',
            'questions'        => 'array',
            'answers'          => 'array',
            'last_training_at' => 'datetime',
        ];
    }
}
