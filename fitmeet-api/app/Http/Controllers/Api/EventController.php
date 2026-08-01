<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicEventShareResource;
use App\Jobs\SendCancelledEventNotifications;
use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Jobs\SendNewEventNotifications;
use App\Models\ActivityRoute;
use App\Models\Event;
use App\Models\EventReminder;
use App\Models\FriendRequest;
use App\Services\BadgeService;
use App\Services\GpxRouteParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EventController extends Controller
{
    private function applyTimeWindow(Request $request, $query)
    {
        if ($request->boolean('past')) {
            $query = $query
                ->whereIn('events.status', ['active', 'cancelled'])
                ->where('events.start_at', '<=', now());

            return $this->applyEventSort($request, $query, 'start_at');
        }

        $query = $query->upcoming();

        return $this->applyEventSort($request, $query, 'created_at');
    }

    private function applyEventSort(Request $request, $query, string $defaultSort)
    {
        $sort = $request->string('sort')->toString();
        $direction = strtolower($request->string('order', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';

        if ($sort === 'views') {
            return $query->orderBy('events.views_count', $direction)
                ->orderByDesc('events.created_at');
        }

        if ($sort === 'joined') {
            return $query->orderBy('events.participants_count', $direction)
                ->orderByDesc('events.created_at');
        }

        if ($sort === 'new') {
            return $query->orderBy('events.created_at', $direction);
        }

        if ($defaultSort === 'start_at') {
            return $query->orderByDesc('events.start_at');
        }

        return $query
            ->orderByRaw('CASE WHEN events.start_at <= NOW() AND DATE_ADD(events.start_at, INTERVAL COALESCE(events.duration_minutes, 60) MINUTE) >= NOW() THEN 0 ELSE 1 END ASC')
            ->orderByDesc('events.created_at');
    }

    private function requestCoordinates(Request $request): array
    {
        $user = $request->user();

        $lat = $request->filled('lat') ? $request->float('lat') : ($user?->home_lat ?? $user?->lat);
        $lng = $request->filled('lng') ? $request->float('lng') : ($user?->home_lng ?? $user?->lng);

        return [
            is_numeric($lat) ? (float) $lat : null,
            is_numeric($lng) ? (float) $lng : null,
        ];
    }

    // GET /api/events
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Event::with('organizer')->withCount('comments');

        $friendIds = FriendRequest::where(function ($q) use ($user) {
            $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
        })->where('status', 'accepted')
          ->get()
          ->map(fn ($r) => $r->sender_id === $user->id ? $r->receiver_id : $r->sender_id)
          ->values();

        if ($request->boolean('friends_only')) {
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
            $query->where(function ($q) use ($friendIds) {
                $q->where('events.is_private', false);
                if ($friendIds->isNotEmpty()) {
                    $q->orWhereIn('events.user_id', $friendIds);
                }
            });
        }

        $query = $this->applyTimeWindow($request, $query);

        // Nearby filter; mobile may send only radius_km, so use the user's saved coordinates.
        [$lat, $lng] = $this->requestCoordinates($request);

        if ($lat !== null && $lng !== null && ($request->filled('lat') || $request->filled('lng') || $request->filled('radius_km'))) {
            $radiusKm = $request->integer('radius_km', $user->radius_km);
            $query->nearby($lat, $lng, $radiusKm);
        }

        // Category filter — accepts a single value or a comma-separated list
        if ($request->filled('category')) {
            $categories = is_array($request->category)
                ? $request->category
                : explode(',', $request->category);
            $query->whereIn('category', $categories);
        }

        // Skill level filter
        if ($request->filled('skill_level')) {
            $query->where('skill_level', $request->skill_level);
        }

        $perPage = max(10, min(100, (int) $request->integer('per_page', 10)));
        $events = $query->paginate($perPage);

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

        // Idempotency: if the client retried a submit that actually succeeded
        // server-side (e.g. the response was lost over a flaky connection),
        // return the event that was already created instead of a duplicate.
        if (! empty($data['client_request_id'])) {
            $existing = $request->user()->events()
                ->where('client_request_id', $data['client_request_id'])
                ->first();

            if ($existing) {
                $existing->load('organizer');

                return response()->json([
                    'data' => new EventResource($existing),
                    'newly_unlocked' => [],
                ], 201);
            }
        }

        $routeTitle = $data['route_title'] ?? null;
        $gpxTextForRoute = null;
        $gpxNameForRoute = $data['gpx_name'] ?? null;
        $importedRoute = $this->requestedPublicRoute($data['route_id'] ?? null);

        if ($importedRoute) {
            $this->applyImportedRouteData($data, $importedRoute);
        } elseif ($request->hasFile('gpx_file')) {
            $file = $request->file('gpx_file');
            $gpxTextForRoute = file_get_contents($file->getRealPath()) ?: null;
            $gpxNameForRoute = $file->getClientOriginalName();
            $data['gpx_path'] = $file->store('gpx', 'public');
        } elseif ($request->filled('gpx_text')) {
            $gpxTextForRoute = (string) $request->string('gpx_text');
            $data['gpx_path'] = $this->storeGpxText(
                $gpxTextForRoute,
                (string) $gpxNameForRoute
            );
        }

        if ($request->hasFile('image_file')) {
            $data['image_path'] = $request->file('image_file')->store('event-images', 'public');
        }

        unset($data['gpx_file'], $data['gpx_text'], $data['gpx_name'], $data['route_title'], $data['image_file']);

        $event = $request->user()->events()->create($data);

        if ($event->gpx_path && $gpxTextForRoute) {
            $this->syncRouteFromEvent($event, $gpxTextForRoute, $routeTitle, $gpxNameForRoute);
        }

        $event->load('organizer');

        SendNewEventNotifications::dispatch($event);

        $newlyUnlocked = app(BadgeService::class)->evaluate($request->user());

        return response()->json([
            'data' => new EventResource($event),
            'newly_unlocked' => $newlyUnlocked,
        ], 201);
    }

    // GET /api/events/{event}
    public function show(Request $request, Event $event): JsonResponse
    {
        $event->increment('views_count');
        $event->load('organizer', 'participants');
        $event->loadCount('comments');

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

    // GET /api/events/public/{event}/gpx
    public function publicGpx(Event $event): \Illuminate\Http\Response
    {
        abort_if($event->is_private || $event->status !== 'active', 404);

        return $this->gpxResponse($event);
    }

    // GET /api/events/public-latest
    public function publicLatest(Request $request): JsonResponse
    {
        $limit = max(1, min(20, (int) $request->integer('limit', 10)));

        $events = Event::query()
            ->with('organizer')
            ->withCount('comments')
            ->where('is_private', false)
            ->where('status', 'active')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => EventResource::collection($events),
        ]);
    }

    // GET /api/events/og?id=X  â€” OG meta HTML for social crawlers
    public function ogPage(Request $request): \Illuminate\Http\Response
    {
        $siteUrl  = 'https://fitmeet.fit';
        $id       = (int) $request->query('id', 0);
        $shareUrl = $siteUrl . '/events/share/' . $id;

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
        if ($event->image_path) {
            $image = url('/storage/' . $event->image_path);
        } elseif ($event->lat && $event->lng) {
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
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma'        => 'no-cache',
        ]);
    }

    // PATCH /api/events/{event}
    public function update(UpdateEventRequest $request, Event $event): JsonResponse
    {
        if (! $event->isOrganizer($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validated();
        $routeTitle = $data['route_title'] ?? null;
        $gpxTextForRoute = null;
        $gpxNameForRoute = $data['gpx_name'] ?? null;
        $importedRoute = $this->requestedPublicRoute($data['route_id'] ?? null);

        if ($importedRoute) {
            $this->deleteOwnedRouteForEvent($event);
            $this->deleteEventGpxIfUnshared($event->gpx_path);
            $this->applyImportedRouteData($data, $importedRoute);
        } elseif ($request->hasFile('gpx_file')) {
            $this->deleteOwnedRouteForEvent($event);
            $this->deleteEventGpxIfUnshared($event->gpx_path);
            $file = $request->file('gpx_file');
            $gpxTextForRoute = file_get_contents($file->getRealPath()) ?: null;
            $gpxNameForRoute = $file->getClientOriginalName();
            $data['gpx_path'] = $file->store('gpx', 'public');
        } elseif ($request->filled('gpx_text')) {
            $this->deleteOwnedRouteForEvent($event);
            $this->deleteEventGpxIfUnshared($event->gpx_path);
            $gpxTextForRoute = (string) $request->string('gpx_text');
            $data['gpx_path'] = $this->storeGpxText(
                $gpxTextForRoute,
                (string) $gpxNameForRoute
            );
        } elseif ($request->boolean('gpx_remove')) {
            $this->removeEventRouteData($event, $data);
        }

        if ($request->hasFile('image_file')) {
            if ($event->image_path) {
                Storage::disk('public')->delete($event->image_path);
            }
            $data['image_path'] = $request->file('image_file')->store('event-images', 'public');
        } elseif ($request->boolean('image_remove')) {
            if ($event->image_path) {
                Storage::disk('public')->delete($event->image_path);
            }
            $data['image_path'] = null;
        }

        unset($data['gpx_file'], $data['gpx_text'], $data['gpx_name'], $data['route_title'], $data['gpx_remove'], $data['image_file'], $data['image_remove']);

        $event->update($data);

        $freshEvent = $event->fresh();
        if ($freshEvent->gpx_path && $gpxTextForRoute) {
            $this->syncRouteFromEvent($freshEvent, $gpxTextForRoute, $routeTitle, $gpxNameForRoute);
        } else {
            $this->syncRouteVisibilityFromEvent($freshEvent);
        }

        $event->load('organizer');

        return response()->json(['data' => new EventResource($event)]);
    }

    // POST /api/events/{event}/moment
    public function storeMoment(Request $request, Event $event): JsonResponse
    {
        if (! $event->isOrganizer($request->user())) {
            return response()->json(['message' => 'Only the organizer can add a moment.'], 403);
        }

        if ($event->start_at->isFuture()) {
            return response()->json(['message' => 'Event has not ended yet.'], 422);
        }

        $endedAt = $event->start_at->copy()->addMinutes($event->duration_minutes ?? 60);
        if ($endedAt->diffInHours(now()) > 48) {
            return response()->json(['message' => 'Upload window has closed (48 hours after event end).'], 422);
        }

        $data = $request->validate([
            'image' => 'required|file|mimes:jpeg,jpg,png,webp|max:10240',
            'cover_x' => 'nullable|numeric|min:0|max:1',
            'cover_y' => 'nullable|numeric|min:0|max:1',
        ]);

        if ($event->moment_image_path) {
            Storage::disk('public')->delete($event->moment_image_path);
        }

        $path = $request->file('image')->store('moments', 'public');
        $event->update([
            'moment_image_path' => $path,
            'moment_cover_x' => $data['cover_x'] ?? 0.5,
            'moment_cover_y' => $data['cover_y'] ?? 0.5,
        ]);

        return response()->json([
            'moment_image_url' => url('/storage/' . $path),
            'moment_cover' => [
                'x' => $event->moment_cover_x ?? 0.5,
                'y' => $event->moment_cover_y ?? 0.5,
            ],
        ]);
    }

    // DELETE /api/events/{event}
    public function destroy(Request $request, Event $event): JsonResponse
    {
        if (! $event->isOrganizer($request->user()) && ! $request->user()->is_admin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($event->status === 'cancelled') {
            return response()->json(['message' => 'Event already cancelled.']);
        }

        $event->update(['status' => 'cancelled']);
        $this->syncRouteVisibilityFromEvent($event->fresh());
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
                ->update(['status' => 'joined', 'joined_at' => now(), 'checked_in_at' => null]);
        } else {
            $event->participants()->attach($user->id, [
                'status'    => 'joined',
                'joined_at' => now(),
            ]);
        }

        $event->increment('participants_count');

        // Notify participants who opted in
        $notifyIds = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('status', 'joined')
            ->where('notify_on_join', true)
            ->where('user_id', '!=', $user->id)
            ->pluck('user_id')
            ->toArray();

        if (!empty($notifyIds)) {
            dispatch(new \App\Jobs\SendPushNotification(
                $notifyIds,
                "{$user->name} joined!",
                $event->title,
                ['event_id' => (string) $event->id, 'type' => 'join_notification'],
            ));
        }

        $event->load('organizer', 'participants');

        $badgeService = app(BadgeService::class);
        $newlyUnlocked = $badgeService->evaluate($user);
        if ($event->organizer) {
            $badgeService->evaluate($event->organizer);
        }

        return response()->json([
            'message' => 'Joined successfully.',
            'data' => new EventResource($event),
            'newly_unlocked' => $newlyUnlocked,
        ]);
    }

    // POST /api/events/{event}/join-notifications
    public function setJoinNotifications(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        $updated = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'joined')
            ->update(['notify_on_join' => $data['enabled']]);

        if (!$updated) {
            return response()->json(['message' => 'You are not a participant of this event.'], 422);
        }

        return response()->json(['notify_on_join' => $data['enabled']]);
    }

    // POST /api/events/{event}/check-in
    public function checkIn(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        if ($event->status !== 'active') {
            return response()->json(['message' => 'Event is not active.'], 422);
        }

        $participant = \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->where('status', 'joined')
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'You are not a participant of this event.'], 422);
        }

        if ($participant->checked_in_at) {
            $event->load('organizer', 'participants');

            return response()->json([
                'checked_in_at' => $participant->checked_in_at,
                'data' => new EventResource($event),
            ]);
        }

        $start = $event->start_at;
        $opensAt = $start->copy()->subMinutes(30);
        $closesAt = $start->copy()->addMinutes($event->duration_minutes ?? 60)->addHours(2);

        if (now()->lt($opensAt) || now()->gt($closesAt)) {
            return response()->json([
                'message' => 'Check-in is not available for this event right now.',
            ], 422);
        }

        $checkedInAt = now();

        \DB::table('event_participants')
            ->where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->where('status', 'joined')
            ->update(['checked_in_at' => $checkedInAt]);

        $event->load('organizer', 'participants');

        return response()->json([
            'checked_in_at' => $checkedInAt->toIso8601String(),
            'data' => new EventResource($event),
        ]);
    }

    // POST /api/events/{event}/leave
    public function leave(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        $participant = $event->participants()->withPivot('status')->find($user->id);

        if (! $participant || $participant->pivot->status === 'cancelled') {
            return response()->json(['message' => 'You are not in this event.'], 422);
        }

        $event->participants()->updateExistingPivot($user->id, ['status' => 'cancelled', 'checked_in_at' => null]);
        $event->decrement('participants_count');
        EventReminder::where('user_id', $user->id)
            ->where('event_id', $event->id)
            ->delete();

        $event->load('organizer', 'participants');

        return response()->json([
            'message' => 'Left successfully.',
            'data' => new EventResource($event),
        ]);
    }

    // GET /api/events/my
    public function my(Request $request): JsonResponse
    {
        $events = $request->user()
            ->events()
            ->with('organizer')
            ->withCount('comments')
            ->whereIn('events.status', ['active', 'cancelled'])
            ->orderByDesc('events.start_at')
            ->get();

        return response()->json(['data' => EventResource::collection($events)]);
    }

    // GET /api/events/{event}/gpx
    public function gpx(Request $request, Event $event): \Illuminate\Http\Response
    {
        return $this->gpxResponse($event);
    }

    private function gpxResponse(Event $event): \Illuminate\Http\Response
    {
        abort_unless($event->gpx_path, 404);

        abort_unless(Storage::disk('public')->exists($event->gpx_path), 404);

        $filename = Str::slug($event->title ?: 'fitmeet-event-' . $event->id) . '.gpx';

        return response(Storage::disk('public')->get($event->gpx_path), 200, [
            'Content-Type'        => 'application/gpx+xml',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'public, max-age=86400',
        ]);
    }

    // GET /api/events/joined
    public function joined(Request $request): JsonResponse
    {
        $query = $request->user()
            ->joinedEvents()
            ->with('organizer')
            ->withCount('comments');

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

    private function storeGpxText(string $gpxText, ?string $name = null): string
    {
        $baseName = Str::limit(Str::slug(pathinfo($name ?: 'route.gpx', PATHINFO_FILENAME)), 80, '');
        $path = 'gpx/' . ($baseName ?: 'route') . '-' . Str::uuid() . '.gpx';

        Storage::disk('public')->put($path, $gpxText);

        return $path;
    }

    private function syncRouteFromEvent(Event $event, string $gpxText, ?string $routeTitle, ?string $gpxName): void
    {
        if ($event->is_private || $event->status === 'cancelled') {
            $this->syncRouteVisibilityFromEvent($event);
            return;
        }

        $parsed = app(GpxRouteParser::class)->parse($gpxText);

        if (count($parsed['track'] ?? []) < 2) {
            return;
        }

        $title = $this->routeTitle($event, $parsed, $routeTitle, $gpxName);
        $start = $parsed['start'] ?? null;
        $end = $parsed['end'] ?? null;

        $route = $event->route_id
            ? ActivityRoute::query()
                ->whereKey($event->route_id)
                ->where('source_event_id', $event->id)
                ->first()
            : null;

        $routeData = [
            'user_id' => $event->user_id,
            'source_event_id' => $event->id,
            'title' => $title,
            'category' => $event->category?->value ?? 'other',
            'distance_km' => $parsed['distance_km'] ?: $event->distance_km,
            'elevation_gain' => $parsed['elevation_gain'] ?: $event->elevation_gain,
            'max_grade' => $parsed['max_grade'] ?: $event->max_grade,
            'max_downgrade' => $parsed['max_downgrade'] ?: $event->max_downgrade,
            'start_lat' => $start[0] ?? null,
            'start_lng' => $start[1] ?? null,
            'end_lat' => $end[0] ?? null,
            'end_lng' => $end[1] ?? null,
            'area_label' => $event->address,
            'gpx_path' => $event->gpx_path,
            'is_public' => true,
        ];

        if ($route) {
            $route->update($routeData);
        } else {
            $route = ActivityRoute::query()->create($routeData);
            $event->forceFill(['route_id' => $route->id])->save();
        }
    }

    private function syncRouteVisibilityFromEvent(Event $event): void
    {
        if (! $event->route_id) {
            return;
        }

        ActivityRoute::query()
            ->whereKey($event->route_id)
            ->where('source_event_id', $event->id)
            ->update([
                'is_public' => ! $event->is_private && $event->status !== 'cancelled',
            ]);
    }

    private function requestedPublicRoute(mixed $routeId): ?ActivityRoute
    {
        if (! $routeId) {
            return null;
        }

        return ActivityRoute::query()
            ->public()
            ->whereKey($routeId)
            ->firstOrFail();
    }

    private function applyImportedRouteData(array &$data, ActivityRoute $route): void
    {
        $data['route_id'] = $route->id;
        $data['gpx_path'] = $route->gpx_path;
        $data['distance_km'] = $route->distance_km;
        $data['elevation_gain'] = $route->elevation_gain;
        $data['max_grade'] = $route->max_grade;
        $data['max_downgrade'] = $route->max_downgrade;

        if (! isset($data['lat']) && $route->start_lat !== null) {
            $data['lat'] = $route->start_lat;
        }
        if (! isset($data['lng']) && $route->start_lng !== null) {
            $data['lng'] = $route->start_lng;
        }
    }

    private function removeEventRouteData(Event $event, array &$data): void
    {
        $this->deleteOwnedRouteForEvent($event);

        $this->deleteEventGpxIfUnshared($event->gpx_path);

        $data['route_id'] = null;
        $data['gpx_path'] = null;
        $data['distance_km'] = null;
        $data['elevation_gain'] = null;
        $data['max_grade'] = null;
        $data['max_downgrade'] = null;
        $data['pace'] = null;
    }

    private function deleteOwnedRouteForEvent(Event $event): void
    {
        if (! $event->route_id) {
            return;
        }

        ActivityRoute::query()
            ->whereKey($event->route_id)
            ->where('source_event_id', $event->id)
            ->delete();
    }

    private function deleteEventGpxIfUnshared(?string $path): void
    {
        if (! $path) {
            return;
        }

        if (ActivityRoute::query()->where('gpx_path', $path)->exists()) {
            return;
        }

        Storage::disk('public')->delete($path);
    }

    private function routeTitle(Event $event, array $parsed, ?string $routeTitle, ?string $gpxName): string
    {
        foreach ([
            $routeTitle,
            $parsed['name'] ?? null,
            $gpxName ? pathinfo($gpxName, PATHINFO_FILENAME) : null,
        ] as $candidate) {
            $candidate = trim((string) $candidate);
            if ($candidate !== '') return Str::limit($candidate, 140, '');
        }

        $category = $event->category?->label() ?? 'Activity';
        $distance = $event->distance_km ?: ($parsed['distance_km'] ?? null);

        return $distance
            ? "{$category} route · {$distance} km"
            : "Route from: {$event->title}";
    }
}
