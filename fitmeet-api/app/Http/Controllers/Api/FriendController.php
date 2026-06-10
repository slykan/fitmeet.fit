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
use App\Models\User;
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

        return response()->json(['message' => 'Friend request accepted.']);
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
        EventReminder::where('user_id', $me->id)->whereNotNull('sent_at')->update(['read_at' => now(), 'sent_at' => now()->subHours(25)]);
        $unreadAnnouncementIds = Announcement::where('created_at', '>=', now()->subDays(30))
            ->whereNotIn('id', AnnouncementRead::where('user_id', $me->id)->pluck('announcement_id'))
            ->pluck('id');
        foreach ($unreadAnnouncementIds as $announcementId) {
            AnnouncementRead::firstOrCreate(['user_id' => $me->id, 'announcement_id' => $announcementId], ['read_at' => now()]);
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

        $readAnnouncementIds = AnnouncementRead::where('user_id', $me->id)->pluck('announcement_id');
        $announcements = Announcement::where('created_at', '>=', now()->subDays(30))
            ->whereNotIn('id', $readAnnouncementIds)
            ->where(fn ($q) => $q->whereNull('target_country')->orWhere('target_country', $me->country))
            ->count();

        return response()->json(['count' => $pending + $accepted + $reminders + $newEvents + $cancelled + $started + $eventComments + $eventMentions + $momentReminders + $announcements]);
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
                'created_at' => $r->created_at->toDateTimeString(),
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
                'created_at' => $r->updated_at->toDateTimeString(),
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
                'created_at' => $r->sent_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
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
                'created_at' => $n->created_at->toDateTimeString(),
            ]);

        $readAnnouncementIds = AnnouncementRead::where('user_id', $me->id)->pluck('announcement_id')->flip();
        $announcements = Announcement::where('created_at', '>=', now()->subDays(30))
            ->where(fn ($q) => $q->whereNull('target_country')->orWhere('target_country', $me->country))
            ->latest()
            ->get()
            ->map(fn ($a) => [
                'id'         => 'ann_' . $a->id,
                'type'       => 'announcement',
                'unread'     => !isset($readAnnouncementIds[$a->id]),
                'title'      => $a->title,
                'body'       => $a->body,
                'data'       => $a->data,
                'created_at' => $a->created_at->toDateTimeString(),
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
