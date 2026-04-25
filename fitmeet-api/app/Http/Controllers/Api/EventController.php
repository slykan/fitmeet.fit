<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicEventShareResource;
use App\Jobs\SendCancelledEventNotifications;
use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Jobs\SendEventPushNotifications;
use App\Jobs\SendNewEventNotifications;
use App\Models\Event;
use App\Models\EventReminder;
use App\Models\FriendRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    private function applyTimeWindow(Request $request, $query)
    {
        if ($request->boolean('past')) {
            return $query
                ->whereIn('events.status', ['active', 'cancelled'])
                ->where('events.start_at', '<=', now())
                ->orderByDesc('events.start_at');
        }

        return $query->upcoming()->orderBy('events.start_at');
    }

    // GET /api/events
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Event::with('organizer');

        if ($request->boolean('friends_only')) {
            $friendIds = FriendRequest::where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            })->where('status', 'accepted')
              ->get()
              ->map(fn ($r) => $r->sender_id === $user->id ? $r->receiver_id : $r->sender_id)
              ->values();

            if ($friendIds->isEmpty()) {
                return response()->json([
                    'data' => [],
                    'meta' => [
                        'current_page' => 1,
                        'last_page' => 1,
                        'total' => 0,
                    ],
                ]);
            }

            $query->whereIn('events.user_id', $friendIds);
        } else {
            $query->public();
        }

        $query = $this->applyTimeWindow($request, $query);

        // Nearby filter â€” only when caller explicitly provides coordinates
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
        SendNewEventNotifications::dispatch($event);

        return response()->json(['data' => new EventResource($event)], 201);
    }

    // GET /api/events/{event}
    public function show(Request $request, Event $event): JsonResponse
    {
        $event->load('organizer', 'participants');

        return response()->json(['data' => new EventResource($event)]);
    }

    // GET /api/events/public/{event}
    public function publicShow(Event $event): JsonResponse
    {
        if ($event->is_private || $event->status !== 'active') {
            return response()->json(['message' => 'Event not found.'], 404);
        }

        $event->load('organizer');

        return response()->json(['data' => new PublicEventShareResource($event)]);
    }

    // GET /api/events/og?id=X  â€” OG meta HTML for social crawlers
    public function ogPage(Request $request): \Illuminate\Http\Response
    {
        $siteUrl  = 'https://fitmeet.fit';
        $id       = (int) $request->query('id', 0);
        $shareUrl = $siteUrl . '/events/share/?id=' . $id;

        $event = $id ? Event::find($id) : null;

        if (! $event || $event->is_private || $event->status !== 'active') {
            return response(
                '<html><head><meta http-equiv="refresh" content="0;url=' . e($shareUrl) . '"></head><body></body></html>',
                200, ['Content-Type' => 'text/html']
            );
        }

        $title   = $event->title . ' | FitMeet';
        $dateStr = $event->start_at ? $event->start_at->copy()->timezone($event->timezone ?? config('app.event_timezone'))->format('D, j M Y - H:i') : '';

        $parts   = [];
        $parts[] = $event->category?->label() ?? $event->category?->value ?? '';
        if ($dateStr)              $parts[] = $dateStr;
        if ($event->duration_minutes) $parts[] = $event->duration_minutes . ' min';
        if ($event->distance_km)   $parts[] = $event->distance_km . ' km';
        if ($event->elevation_gain) $parts[] = 'â†‘' . $event->elevation_gain . ' m';
        if ($event->skill_level)   $parts[] = ucfirst($event->skill_level);
        $parts[] = $event->participants_count . ' going';
        if ($event->description)   $parts[] = $event->description;

        $description = mb_substr(implode(' Â· ', array_filter($parts)), 0, 300);

        $image = $siteUrl . '/logo_full.png';
        if ($event->lat && $event->lng) {
            $z = 14;
            $x = (int) floor(($event->lng + 180) / 360 * (1 << $z));
            $y = (int) floor((1 - log(tan(deg2rad($event->lat)) + 1 / cos(deg2rad($event->lat))) / M_PI) / 2 * (1 << $z));
            $image = "https://tile.openstreetmap.org/{$z}/{$x}/{$y}.png";
        }

        $h    = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $html = <<<HTML
<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>{$h($title)}</title>
<meta name="description" content="{$h($description)}">
<meta property="og:type"         content="article">
<meta property="og:site_name"    content="FitMeet">
<meta property="og:title"        content="{$h($title)}">
<meta property="og:description"  content="{$h($description)}">
<meta property="og:url"          content="{$h($shareUrl)}">
<meta property="og:image"        content="{$h($image)}">
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="{$h($title)}">
<meta name="twitter:description" content="{$h($description)}">
<meta name="twitter:image"       content="{$h($image)}">
<meta http-equiv="refresh" content="0;url={$h($shareUrl)}">
</head><body>
<h1>{$h($event->title)}</h1>
<p>{$h($description)}</p>
<a href="{$h($shareUrl)}">Open in FitMeet</a>
</body></html>
HTML;

        return response($html, 200, [
            'Content-Type'  => 'text/html; charset=UTF-8',
            'Cache-Control' => 'public, max-age=300',
        ]);
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

        if ($event->status === 'cancelled') {
            return response()->json(['message' => 'Event already cancelled.']);
        }

        $event->update(['status' => 'cancelled']);
        EventReminder::where('event_id', $event->id)->delete();
        SendCancelledEventNotifications::dispatch($event->load('organizer', 'participants'));

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
        $query = $request->user()
            ->events()
            ->with('organizer');

        $events = $this->applyTimeWindow($request, $query)
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
        $query = $request->user()
            ->joinedEvents()
            ->with('organizer');

        $events = $this->applyTimeWindow($request, $query)
            ->get();

        return response()->json(['data' => EventResource::collection($events)]);
    }

    // POST /api/events/{event}/remind
    public function setReminders(Request $request, Event $event): JsonResponse
    {
        $request->validate([
            'offsets'   => 'present|array',
            'offsets.*' => 'in:1h,5h,1d',
        ]);

        $user      = $request->user();
        $offsets   = $request->input('offsets', []);
        $offsetMap = ['1h' => 60, '5h' => 300, '1d' => 1440];

        if (count($offsets) === 0) {
            EventReminder::where('user_id', $user->id)
                ->where('event_id', $event->id)
                ->delete();

            return response()->json(['message' => 'Reminders cleared.']);
        }

        // Delete removed offsets
        EventReminder::where('user_id', $user->id)
            ->where('event_id', $event->id)
            ->whereNotIn('remind_offset', $offsets)
            ->delete();

        foreach ($offsets as $offset) {
            $remindAt = $event->start_at->copy()->subMinutes($offsetMap[$offset]);
            if ($remindAt->isPast()) continue;

            EventReminder::updateOrCreate(
                ['user_id' => $user->id, 'event_id' => $event->id, 'remind_offset' => $offset],
                ['remind_at' => $remindAt, 'sent_at' => null]
            );
        }

        return response()->json(['message' => 'Reminders updated.']);
    }

    // GET /api/events/my-reminders â€” active (unsent) reminders for current user
    public function myReminders(Request $request): JsonResponse
    {
        $reminders = EventReminder::where('user_id', $request->user()->id)
            ->whereNull('sent_at')
            ->get()
            ->groupBy('event_id')
            ->map(fn ($group) => $group->pluck('remind_offset')->values());

        return response()->json(['data' => $reminders]);
    }

    // DELETE /api/events/{event}/remind/{offset} â€” cancel one reminder
    public function deleteReminder(Request $request, Event $event, string $offset): JsonResponse
    {
        EventReminder::where('user_id', $request->user()->id)
            ->where('event_id', $event->id)
            ->where('remind_offset', $offset)
            ->delete();

        return response()->json(['message' => 'Reminder cancelled.']);
    }
}
