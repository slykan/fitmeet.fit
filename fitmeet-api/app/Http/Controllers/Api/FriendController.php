<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Jobs\SendPushNotification;
use App\Mail\FriendAcceptedMail;
use App\Mail\FriendRequestMail;
use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Models\EventNotification;
use App\Models\EventReminder;
use App\Models\FriendRequest;
use App\Models\RiderStoppedNotification;
use App\Models\TrainingNotification;
use App\Models\User;
use App\Services\BadgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class FriendController extends Controller
{
    // POST /friends/request/{user}
    public function request(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        if ($me->id === $user->id) {
            return response()->json(['message' => 'Cannot add yourself.'], 422);
        }

        $existing = FriendRequest::where(function ($q) use ($me, $user) {
            $q->where('sender_id', $me->id)->where('receiver_id', $user->id);
        })->orWhere(function ($q) use ($me, $user) {
            $q->where('sender_id', $user->id)->where('receiver_id', $me->id);
        })->whereIn('status', ['pending', 'accepted'])->first();

        if ($existing) {
            return response()->json(['message' => 'Request already exists.', 'status' => $existing->status], 422);
        }

        FriendRequest::create([
            'sender_id'   => $me->id,
            'receiver_id' => $user->id,
            'status'      => 'pending',
        ]);

        if ($user->email_friend_requests) {
            try {
                Mail::to($user->email)->send(new FriendRequestMail($me, $user));
            } catch (\Throwable) {}
        }

        SendPushNotification::dispatch(
            [$user->id],
            'New friend request',
            "{$me->name} sent you a friend request.",
            [
                'type' => 'friend_request',
                'user_id' => $me->id,
            ],
        );

        return response()->json(['message' => 'Friend request sent.']);
    }

    // DELETE /friends/cancel/{user}  — sender cancels their own pending request
    public function cancel(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        FriendRequest::where('sender_id', $me->id)
            ->where('receiver_id', $user->id)
            ->where('status', 'pending')
            ->delete();

        return response()->json(['message' => 'Request cancelled.']);
    }

    // POST /friends/accept/{friendRequest}
    public function accept(Request $request, FriendRequest $friendRequest): JsonResponse
    {
        $this->authorizeReceiver($request, $friendRequest);
        $friendRequest->load('sender');
        $friendRequest->update(['status' => 'accepted']);

        if ($friendRequest->sender->email_friend_requests) {
            try {
                Mail::to($friendRequest->sender->email)
                    ->send(new FriendAcceptedMail($request->user(), $friendRequest->sender));
            } catch (\Throwable) {}
        }

        SendPushNotification::dispatch(
            [$friendRequest->sender_id],
            'Friend request accepted',
            "{$request->user()->name} accepted your friend request.",
            [
                'type' => 'friend_accepted',
                'user_id' => $request->user()->id,
            ],
        );

        $badgeService = app(BadgeService::class);
        $badgeService->evaluate($friendRequest->sender);
        $newlyUnlocked = $badgeService->evaluate($request->user());

        return response()->json([
            'message' => 'Friend request accepted.',
            'newly_unlocked' => $newlyUnlocked,
        ]);
    }

    // POST /friends/decline/{friendRequest}
    public function decline(Request $request, FriendRequest $friendRequest): JsonResponse
    {
        $this->authorizeReceiver($request, $friendRequest);
        $friendRequest->delete();
        return response()->json(['message' => 'Friend request declined.']);
    }

    // DELETE /notifications/clear-all
    public function notificationsClearAll(Request $request): JsonResponse
    {
        $me = $request->user();
        FriendRequest::where('sender_id', $me->id)->where('status', 'accepted')->whereNull('accepted_read_at')->update(['accepted_read_at' => now()]);
        EventNotification::where('user_id', $me->id)->delete();
        TrainingNotification::where('user_id', $me->id)->delete();
        RiderStoppedNotification::where('user_id', $me->id)->delete();
        EventReminder::where('user_id', $me->id)->whereNotNull('sent_at')->update(['read_at' => now(), 'sent_at' => now()->subHours(25)]);
        $allAnnouncementIds = Announcement::where('created_at', '>=', now()->subDays(30))->pluck('id');
        foreach ($allAnnouncementIds as $announcementId) {
            $read = AnnouncementRead::firstOrCreate(
                ['user_id' => $me->id, 'announcement_id' => $announcementId],
                ['read_at' => now()]
            );
            $read->update(['dismissed_at' => now()]);
        }
        return response()->json(['message' => 'Cleared.']);
    }

    // POST /notifications/read
    public function notificationsMarkRead(Request $request): JsonResponse
    {
        $me = $request->user();

        FriendRequest::where('sender_id', $me->id)
            ->where('status', 'accepted')
            ->whereNull('accepted_read_at')
            ->update(['accepted_read_at' => now()]);

        EventNotification::where('user_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        TrainingNotification::where('user_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        RiderStoppedNotification::where('user_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        EventReminder::where('user_id', $me->id)
            ->whereNotNull('sent_at')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $readIds = AnnouncementRead::where('user_id', $me->id)->pluck('announcement_id');
        $unread = Announcement::where('created_at', '>=', now()->subDays(30))
            ->whereNotIn('id', $readIds)
            ->where(fn ($q) => $q->whereNull('target_country')->orWhere('target_country', $me->country))
            ->pluck('id');
        foreach ($unread as $id) {
            AnnouncementRead::firstOrCreate(['user_id' => $me->id, 'announcement_id' => $id], ['read_at' => now()]);
        }

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    // GET /notifications/count
    public function notificationsCount(Request $request): JsonResponse
    {
        $me = $request->user();

        $pending = FriendRequest::where('receiver_id', $me->id)->where('status', 'pending')->count();
        $accepted = FriendRequest::where('sender_id', $me->id)->where('status', 'accepted')->whereNull('accepted_read_at')->count();
        $reminders = EventReminder::where('user_id', $me->id)->whereNotNull('sent_at')->whereNull('read_at')->where('sent_at', '>=', now()->subHours(24))->count();
        $newEvents = EventNotification::where('user_id', $me->id)->where('type', 'new_event')->where('created_at', '>=', now()->subDays(7))
            ->whereNull('read_at')
            ->whereHas('event', fn ($q) => $q->where('events.start_at', '>', now())->where('events.status', 'active'))->count();
        $cancelled = EventNotification::where('user_id', $me->id)->where('type', 'event_cancelled')->where('created_at', '>=', now()->subDays(30))
            ->whereNull('read_at')
            ->whereHas('event', fn ($q) => $q->where('events.status', 'cancelled'))->count();
        $started = EventNotification::where('user_id', $me->id)->where('type', 'event_started')->where('created_at', '>=', now()->subHours(24))
            ->whereNull('read_at')
            ->whereHas('event', fn ($q) => $q->where('events.status', 'active'))->count();
        $eventComments = EventNotification::where('user_id', $me->id)->where('type', 'event_comment')
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subDays(14))
            ->count();
        $eventMentions = EventNotification::where('user_id', $me->id)->where('type', 'event_comment_mention')
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subDays(14))
            ->count();
        $momentReminders = EventNotification::where('user_id', $me->id)->where('type', 'moment_reminder')
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subHours(48))
            ->count();
        $trainingsSynced = TrainingNotification::where('user_id', $me->id)
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subDays(14))
            ->count();
        $ridersStopped = RiderStoppedNotification::where('user_id', $me->id)
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        $readAnnouncementIds = AnnouncementRead::where('user_id', $me->id)->pluck('announcement_id');
        $announcements = Announcement::where('created_at', '>=', now()->subDays(30))
            ->whereNotIn('id', $readAnnouncementIds)
            ->where(fn ($q) => $q->whereNull('target_country')->orWhere('target_country', $me->country))
            ->count();

        return response()->json(['count' => $pending + $accepted + $reminders + $newEvents + $cancelled + $started + $eventComments + $eventMentions + $momentReminders + $trainingsSynced + $ridersStopped + $announcements]);
    }

    // GET /notifications
    public function notifications(Request $request): JsonResponse
    {
        $me = $request->user();

        // Pending requests I received
        $pending = FriendRequest::with('sender')
            ->where('receiver_id', $me->id)
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(fn ($r) => [
                'id'         => $r->id,
                'type'       => 'friend_request',
                'sender'     => new UserResource($r->sender),
                'created_at' => $r->created_at->toIso8601String(),
            ]);

        // Accepted requests I sent (unread)
        $accepted = FriendRequest::with('receiver')
            ->where('sender_id', $me->id)
            ->where('status', 'accepted')
            ->whereNull('accepted_read_at')
            ->latest('updated_at')
            ->get()
            ->map(fn ($r) => [
                'id'         => $r->id,
                'type'       => 'friend_accepted',
                'friend'     => new UserResource($r->receiver),
                'created_at' => $r->updated_at->toIso8601String(),
            ]);

        // Mark accepted as read now that user fetched them
        FriendRequest::where('sender_id', $me->id)
            ->where('status', 'accepted')
            ->whereNull('accepted_read_at')
            ->update(['accepted_read_at' => now()]);

        // Event reminders sent in the last 24 h
        $eventReminders = EventReminder::with('event')
            ->where('user_id', $me->id)
            ->whereNotNull('sent_at')
            ->where('sent_at', '>=', now()->subHours(24))
            ->latest('sent_at')
            ->get()
            ->map(fn ($r) => [
                'id'            => $r->id,
                'type'          => 'event_reminder',
                'unread'        => $r->read_at === null,
                'remind_offset' => $r->remind_offset,
                'event'         => [
                    'id'       => $r->event->id,
                    'title'    => $r->event->title,
                    'start_at' => $r->event->start_at->toIso8601String(),
                    'timezone' => $r->event->timezone ?? config('app.event_timezone'),
                    'address'  => $r->event->address,
                    'category' => $r->event->category?->label() ?? 'Event',
                ],
                'created_at' => $r->sent_at->toIso8601String(),
            ]);

        // New events matching interests (last 7 days, event not yet started)
        $newEvents = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'new_event')
            ->where('created_at', '>=', now()->subDays(7))
            ->whereHas('event', fn ($q) => $q->where('events.start_at', '>', now())->where('events.status', 'active'))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => 'new_event',
                'unread'     => $n->read_at === null,
                'event'      => [
                    'id'           => $n->event->id,
                    'title'        => $n->event->title,
                    'start_at'     => $n->event->start_at->toIso8601String(),
                    'timezone'     => $n->event->timezone ?? config('app.event_timezone'),
                    'address'      => $n->event->address,
                    'category'     => $n->event->category?->label() ?? 'Event',
                    'distance_km'  => $n->event->distance_km,
                    'elevation_gain' => $n->event->elevation_gain,
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $cancelledEvents = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'event_cancelled')
            ->where('created_at', '>=', now()->subDays(30))
            ->whereHas('event', fn ($q) => $q->where('events.status', 'cancelled'))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => 'event_cancelled',
                'unread'     => $n->read_at === null,
                'event'      => [
                    'id'       => $n->event->id,
                    'title'    => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address'  => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $startedEvents = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'event_started')
            ->where('created_at', '>=', now()->subHours(24))
            ->whereHas('event', fn ($q) => $q->where('events.status', 'active'))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => 'event_started',
                'unread'     => $n->read_at === null,
                'event'      => [
                    'id'       => $n->event->id,
                    'title'    => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address'  => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $eventComments = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'event_comment')
            ->where('created_at', '>=', now()->subDays(14))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'type' => 'event_comment',
                'unread' => $n->read_at === null,
                'event' => [
                    'id' => $n->event->id,
                    'title' => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address' => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $eventMentions = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'event_comment_mention')
            ->where('created_at', '>=', now()->subDays(14))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'type' => 'event_comment_mention',
                'unread' => $n->read_at === null,
                'event' => [
                    'id' => $n->event->id,
                    'title' => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address' => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $momentReminders = EventNotification::with('event')
            ->where('user_id', $me->id)
            ->where('type', 'moment_reminder')
            ->where('created_at', '>=', now()->subHours(48))
            ->latest()
            ->get()
            ->map(fn ($n) => [
                'id'   => $n->id,
                'type' => 'moment_reminder',
                'unread' => $n->read_at === null,
                'event' => [
                    'id'       => $n->event->id,
                    'title'    => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address'  => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $trainingsSynced = TrainingNotification::with('training')
            ->where('user_id', $me->id)
            ->where('created_at', '>=', now()->subDays(14))
            ->latest()
            ->get()
            ->filter(fn ($n) => $n->training !== null)
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => 'training_synced',
                'unread'     => $n->read_at === null,
                'training'   => [
                    'id'         => $n->training->id,
                    'name'       => $n->training->name,
                    'category'   => ['value' => $n->training->category->value, 'label' => $n->training->category->label()],
                    'provider'   => $n->training->provider,
                    'distance_m' => $n->training->distance_m,
                    'duration_s' => $n->training->duration_s,
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $ridersStopped = RiderStoppedNotification::with(['event', 'stoppedUser'])
            ->where('user_id', $me->id)
            ->where('created_at', '>=', now()->subDays(7))
            ->latest()
            ->get()
            ->filter(fn ($n) => $n->event !== null && $n->stoppedUser !== null)
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => 'rider_stopped',
                'unread'     => $n->read_at === null,
                'event'      => [
                    'id'       => $n->event->id,
                    'title'    => $n->event->title,
                    'start_at' => $n->event->start_at->toIso8601String(),
                    'timezone' => $n->event->timezone ?? config('app.event_timezone'),
                    'address'  => $n->event->address,
                    'category' => $n->event->category?->label() ?? 'Event',
                ],
                'stopped_user' => [
                    'id'     => $n->stoppedUser->id,
                    'name'   => $n->stoppedUser->name,
                    'avatar' => $n->stoppedUser->avatar,
                ],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        $announcementReads = AnnouncementRead::where('user_id', $me->id)->get()->keyBy('announcement_id');
        $dismissedIds = $announcementReads->filter(fn ($r) => $r->dismissed_at !== null)->keys()->all();
        $announcements = Announcement::where('created_at', '>=', now()->subDays(30))
            ->whereNotIn('id', $dismissedIds)
            ->where(fn ($q) => $q
                ->where(fn ($broadcast) => $broadcast
                    ->whereNull('target_user_id')
                    ->where(fn ($country) => $country->whereNull('target_country')->orWhere('target_country', $me->country))
                )
                ->orWhere('target_user_id', $me->id)
            )
            ->latest()
            ->get()
            ->map(fn ($a) => [
                'id'         => 'ann_' . $a->id,
                'type'       => 'announcement',
                'unread'     => !isset($announcementReads[$a->id]),
                'title'      => $a->title,
                'body'       => $a->body,
                'data'       => $a->data,
                'created_at' => $a->created_at->toIso8601String(),
            ]);

        return response()->json([
            'data' => $pending
                ->concat($accepted)
                ->concat($eventReminders)
                ->concat($newEvents)
                ->concat($cancelledEvents)
                ->concat($startedEvents)
                ->concat($eventComments)
                ->concat($eventMentions)
                ->concat($momentReminders)
                ->concat($trainingsSynced)
                ->concat($ridersStopped)
                ->concat($announcements)
                ->sortByDesc('created_at')
                ->values(),
        ]);
    }

    // DELETE /friends/{user}  — remove accepted friend
    public function remove(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        FriendRequest::where(function ($q) use ($me, $user) {
            $q->where('sender_id', $me->id)->where('receiver_id', $user->id);
        })->orWhere(function ($q) use ($me, $user) {
            $q->where('sender_id', $user->id)->where('receiver_id', $me->id);
        })->delete();

        return response()->json(['message' => 'Friend removed.']);
    }

    private function authorizeReceiver(Request $request, FriendRequest $friendRequest): void
    {
        if ($friendRequest->receiver_id !== $request->user()->id) {
            abort(403);
        }
    }
}
