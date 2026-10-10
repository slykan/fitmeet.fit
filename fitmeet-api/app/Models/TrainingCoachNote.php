<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrainingCoachNote extends Model
{
    protected $fillable = ['training_id', 'user_id', 'language', 'headline', 'summary', 'tip', 'questions', 'answers', 'model'];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'answers'   => 'array',
        ];
    }
}
