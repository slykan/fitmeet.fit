<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Announcement extends Model
{
    protected $fillable = ['sent_by', 'title', 'body', 'data', 'target_platform', 'target_country', 'target_user_id'];

    protected $casts = ['data' => 'array'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(AnnouncementRead::class);
    }
}
