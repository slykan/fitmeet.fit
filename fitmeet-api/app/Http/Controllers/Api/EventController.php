<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Jobs\SendEventPushNotifications;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    // GET /api/events
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Event::with('organizer')
            ->withCount(['participants as participants_count'])
            ->upcoming()
            ->public();

        // Nearby filter — use user's active location or provided coords
        $lat = $request->float('lat', $user->lat);
        $lng = $request->float('lng', $user->lng);

        if ($lat && $lng) {
            $radiusKm = $request->integer('radius_km', $user->radius_km);
            $query->nearby($lat, $lng, $radiusKm);
        }

        // Category filter
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        // Skill level filter
        if ($request->filled('skill_level')) {
            $query->where('skill_level', $request->skill_level);
        }

        $events = $query->paginate(20);

        return response()->json([
            'data' => EventResource::collection($events->items()),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page'    => $events->lastPage(),
                'total'        => $events->total(),
            ],
        ]);
    }

    // POST /api/events
    public function store(StoreEventRequest $request): JsonResponse
    {
        $data = $request->validated();

        if ($request->hasFile('gpx_file')) {
            $data['gpx_path'] = $request->file('gpx_file')->store('gpx', 'public');
        }

        unset($data['gpx_file']);

        $event = $request->user()->events()->create($data);
        $event->load('organizer');

        SendEventPushNotifications::dispatch($event);

        return response()->json(['data' => new EventResource($event)], 201);
    }

    // GET /api/events/{event}
    public function show(Request $request, Event $event): JsonResponse
    {
        $event->load('organizer', 'participants');

        return response()->json(['data' => new EventResource($event)]);
    }

    // PATCH /api/events/{event}
    public function update(UpdateEventRequest $request, Event $event): JsonResponse
    {
        if (! $event->isOrganizer($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validated();

        if ($request->hasFile('gpx_file')) {
            $data['gpx_path'] = $request->file('gpx_file')->store('gpx', 'public');
        }

        unset($data['gpx_file']);

        $event->update($data);
        $event->load('organizer');

        return response()->json(['data' => new EventResource($event)]);
    }

    // DELETE /api/events/{event}
    public function destroy(Request $request, Event $event): JsonResponse
    {
        if (! $event->isOrganizer($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $event->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Event cancelled.']);
    }

    // POST /api/events/{event}/join
    public function join(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        if ($event->status !== 'active') {
            return response()->json(['message' => 'Event is not active.'], 422);
        }

        if ($event->isOrganizer($user)) {
            return response()->json(['message' => 'You are the organizer.'], 422);
        }

        if ($event->isFull()) {
            return response()->json(['message' => 'Event is full.'], 422);
        }

        $existing = $event->participants()->withPivot('status')->find($user->id);

        if ($existing && $existing->pivot->status === 'joined') {
            return response()->json(['message' => 'Already joined.'], 422);
        }

        if ($existing) {
            // Rejoin after cancel
            $event->participants()->updateExistingPivot($user->id, [
                'status'    => 'joined',
                'joined_at' => now(),
            ]);
        } else {
            $event->participants()->attach($user->id, [
                'status'    => 'joined',
                'joined_at' => now(),
            ]);
        }

        $event->increment('participants_count');

        return response()->json(['message' => 'Joined successfully.']);
    }

    // POST /api/events/{event}/leave
    public function leave(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        $participant = $event->participants()->withPivot('status')->find($user->id);

        if (! $participant || $participant->pivot->status === 'cancelled') {
            return response()->json(['message' => 'You are not in this event.'], 422);
        }

        $event->participants()->updateExistingPivot($user->id, ['status' => 'cancelled']);
        $event->decrement('participants_count');

        return response()->json(['message' => 'Left successfully.']);
    }

    // GET /api/events/my
    public function my(Request $request): JsonResponse
    {
        $events = $request->user()
            ->events()
            ->with('organizer')
            ->upcoming()
            ->orderBy('start_at')
            ->get();

        return response()->json(['data' => EventResource::collection($events)]);
    }

    // GET /api/events/joined
    public function joined(Request $request): JsonResponse
    {
        $events = $request->user()
            ->joinedEvents()
            ->with('organizer')
            ->upcoming()
            ->orderBy('start_at')
            ->get();

        return response()->json(['data' => EventResource::collection($events)]);
    }
}
