<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingDetail extends Model
{
    protected $fillable = [
        'training_id',
        'details',
        'streams',
        'details_fetched_at',
        'streams_fetched_at',
        'attempts',
    ];

    protected function casts(): array
    {
        return [
            'details'            => 'array',
            'streams'            => 'array',
            'details_fetched_at' => 'datetime',
            'streams_fetched_at' => 'datetime',
        ];
    }

    public function training(): BelongsTo
    {
        return $this->belongsTo(Training::class);
    }
}
