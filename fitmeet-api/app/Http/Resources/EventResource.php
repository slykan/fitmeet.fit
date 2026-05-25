<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class EventResource extends JsonResource
{
    private function isoDate(mixed $value): ?string
    {
        return $value ? Carbon::parse($value)->toIso8601String() : null;
    }

    public function toArray(Request $request): array
    {
        $user = $request->user();
        $currentParticipant = $user
            ? $this->participants->first(fn ($p) => $p->id === $user->id)
            : null;

        return [
            'id'          => $this->id,
            'title'       => $this->title,
            'description' => $this->description,
            'image_url'        => $this->image_path ? url('/storage/' . $this->image_path) : null,
            'moment_image_url' => $this->moment_image_path ? url('/storage/' . $this->moment_image_path) : null,
            'moment_cover' => $this->moment_image_path ? [
                'x' => $this->moment_cover_x ?? 0.5,
                'y' => $this->moment_cover_y ?? 0.5,
            ] : null,
            'category'    => $this->category ? [
                'value' => $this->category->value,
                'label' => $this->category->label(),
                'group' => $this->category->group(),
            ] : ['value' => 'other', 'label' => 'Other', 'group' => 'Misc'],

            'location' => [
                'lat'     => $this->lat,
                'lng'     => $this->lng,
                'address' => $this->address,
            ],

            'schedule' => [
                'start_at'         => $this->start_at->toIso8601String(),
                'timezone'         => $this->timezone ?? config('app.event_timezone'),
                'duration_minutes' => $this->duration_minutes,
            ],

            'activity' => [
                'distance_km'    => $this->distance_km,
                'elevation_gain' => $this->elevation_gain,
                'pace'           => $this->pace,
                'max_grade'      => $this->max_grade,
                'max_downgrade'  => $this->max_downgrade,
                'gpx_url'        => $this->gpx_path ? url('/storage/' . $this->gpx_path) : null,
            ],

            'skill_level'        => $this->skill_level,
            'max_participants'   => $this->max_participants,
            'participants_count' => $this->participants_count,
            'is_full'            => $this->isFull(),
            'is_private'         => $this->is_private,
            'status'             => $this->status,
            'is_in_progress'     => $this->start_at->lte(now()) &&
                                    $this->start_at->copy()->addMinutes($this->duration_minutes ?? 60)->gte(now()),

            'organizer'    => new UserResource($this->whenLoaded('organizer')),
            'participants' => $this->whenLoaded('participants', fn () =>
                $this->participants
                    ->filter(fn ($p) => $p->pivot->status === 'joined')
                    ->map(fn ($p) => [
                        'id' => $p->id,
                        'name' => $p->name,
                        'avatar' => $p->avatar,
                        'checked_in_at' => $this->isoDate($p->pivot?->checked_in_at),
                    ])
                    ->values()
            ),
            'checked_in_count' => $this->whenLoaded('participants', fn () =>
                $this->participants
                    ->filter(fn ($p) => $p->pivot->status === 'joined' && $p->pivot?->checked_in_at)
                    ->count()
            ),

            'views_count'  => $this->views_count ?? 0,
            'comments_count' => $this->comments_count ?? 0,
            'youtube_url'  => $this->youtube_url,

            // Auth-dependent fields
            'is_organizer' => $user ? $this->isOrganizer($user) : false,
            'is_joined'    => $user ? $this->participants->contains(
                fn ($participant) => $participant->id === $user->id && $participant->pivot?->status === 'joined'
            ) : false,
            'notify_on_join' => $user ? (bool) ($currentParticipant?->pivot?->notify_on_join ?? false) : false,
            'checked_in_at' => $user ? $this->isoDate($currentParticipant?->pivot?->checked_in_at) : null,

            // Distance from user (set by scopeNearby)
            'distance_km' => isset($this->distance_from_user)
                ? round($this->distance_from_user, 1)
                : null,

            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }
}
