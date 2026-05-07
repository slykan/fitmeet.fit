<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $isOrganizer = $viewer ? ((int) $this->event?->user_id === (int) $viewer->id) : false;

        return [
            'id' => $this->id,
            'body' => $this->body,
            'created_at' => $this->created_at?->toIso8601String(),
            'user' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
                'avatar' => $this->user?->avatar,
            ],
            'is_mine' => $viewer ? (int) $this->user_id === (int) $viewer->id : false,
            'can_delete' => $viewer ? ((int) $this->user_id === (int) $viewer->id || $isOrganizer) : false,
        ];
    }
}
