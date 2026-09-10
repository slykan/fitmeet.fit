<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    // GET /feed?before=<ISO timestamp>
    public function index(Request $request): JsonResponse
    {
        $me = $request->user();

        $friendIds = $me->acceptedFriendIds()->diff($me->blockedUserIds())->values();

        $query = Activity::with(['actor:id,name,avatar', 'event:id,title,category,start_at,timezone,address,is_private,user_id,image_path'])
            ->whereIn('actor_id', $friendIds)
            ->whereHas('event', function ($q) use ($me) {
                $q->where('is_private', false)
                    ->orWhere('user_id', $me->id)
                    ->orWhereHas('participants', fn ($p) => $p->where('users.id', $me->id));
            })
            ->latest('created_at');

        if ($request->filled('before')) {
            $query->where('created_at', '<', $request->date('before'));
        }

        $activities = $query->limit(20)->get();

        return response()->json([
            'data' => $activities->map(fn (Activity $a) => [
                'id'         => $a->id,
                'type'       => $a->type,
                'meta'       => $a->meta,
                'actor'      => [
                    'id'     => $a->actor->id,
                    'name'   => $a->actor->name,
                    'avatar' => $a->actor->avatar,
                ],
                'event'      => [
                    'id'        => $a->event->id,
                    'title'     => $a->event->title,
                    'category'  => $a->event->category?->label() ?? 'Event',
                    'start_at'  => $a->event->start_at->toIso8601String(),
                    'timezone'  => $a->event->timezone ?? config('app.event_timezone'),
                    'address'   => $a->event->address,
                    'image_url' => $a->event->image_path ? url('/storage/' . $a->event->image_path) : null,
                ],
                'created_at' => $a->created_at->toIso8601String(),
            ]),
            'has_more' => $activities->count() === 20,
        ]);
    }
}
