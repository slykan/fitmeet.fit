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
            ->upcoming()
            ->public();

        // Nearby filter — only when caller explicitly provides coordinates
        $lat = $request->filled('lat') ? $request->float('lat') : null;
        $lng = $request->filled('lng') ? $request->float('lng') : null;

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

        if ($event->isFull()) {
            return response()->json(['message' => 'Event is full.'], 422);
        }

        $existingRow = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existingRow?->status === 'joined') {
            return response()->json(['message' => 'Already joined.'], 422);
        }

        if ($existingRow) {
            // Rejoin after leave/cancel
            \DB::table('event_participants')
                ->where('event_id', $event->id)
                ->where('user_id', $user->id)
                ->update(['status' => 'joined', 'joined_at' => now()]);
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

    // GET /api/events/{event}/gpx
    public function gpx(Request $request, Event $event): \Illuminate\Http\Response
    {
        abort_unless($event->gpx_path, 404);
        $path = storage_path('app/public/' . $event->gpx_path);
        abort_unless(file_exists($path), 404);
        return response(file_get_contents($path), 200, [
            'Content-Type'  => 'application/gpx+xml',
            'Cache-Control' => 'public, max-age=86400',
        ]);
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
