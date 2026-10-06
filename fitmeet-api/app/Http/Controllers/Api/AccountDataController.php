<?php

namespace App\Http\Controllers\Api;

use App\Models\ActivityRoute;
use App\Models\Event;
use App\Models\EventComment;
use App\Models\FriendRequest;
use App\Models\MarketplaceListing;
use App\Models\Message;
use App\Models\ProviderAuthorizationEvent;
use App\Models\ProviderConnection;
use App\Models\Training;
use App\Models\UserBadge;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// GET /api/me/export — "right to access": everything FitMeet stores about the signed-in
// user, as one JSON file the user downloads from Settings/Profile. Secrets (password hash,
// provider access/refresh tokens, push tokens) are never included.
class AccountDataController
{
    public function export(Request $request)
    {
        return $this->download($request->user());
    }

    // POST /api/me/export-link — the mobile app opens this short-lived URL in the browser,
    // which downloads the same file without the app needing file-sharing modules.
    public function exportLink(Request $request): JsonResponse
    {
        return response()->json([
            'url' => URL::temporarySignedRoute('account.export', now()->addMinutes(10), ['user' => $request->user()->id]),
        ]);
    }

    // GET /api/export/{user}?signature=… — signed, expires after 10 minutes.
    public function signedExport(User $user)
    {
        return $this->download($user);
    }

    private function download(User $user)
    {
        $uid = $user->id;

        $profile = $user->makeHidden(['password', 'remember_token', 'fcm_token'])->toArray();

        $data = [
            'exported_at' => now()->toIso8601String(),
            'service'     => 'FitMeet (https://fitmeet.fit)',
            'profile'     => $profile,
            'trainings'   => Training::where('user_id', $uid)->orderBy('started_at')->get()->toArray(),
            'connected_apps' => ProviderConnection::where('user_id', $uid)->get()
                ->map(fn (ProviderConnection $c) => [
                    'provider'       => $c->provider,
                    'status'         => $c->status,
                    'scope'          => $c->scope,
                    'connected_at'   => $c->connected_at,
                    'last_synced_at' => $c->last_synced_at,
                ])->all(),
            'authorization_history' => ProviderAuthorizationEvent::where('user_id', $uid)->orderBy('created_at')
                ->get(['provider', 'event', 'scope', 'source', 'created_at'])->toArray(),
            'events_created'   => Event::where('user_id', $uid)->orderBy('start_at')->get()->toArray(),
            'event_participation' => Schema::hasTable('event_participants')
                ? DB::table('event_participants')->where('user_id', $uid)->get()->toArray()
                : [],
            'event_comments'   => EventComment::where('user_id', $uid)->orderBy('created_at')->get()->toArray(),
            'routes'           => ActivityRoute::where('user_id', $uid)->orderBy('created_at')->get()->toArray(),
            'messages_sent'    => Message::where('sender_id', $uid)->orderBy('created_at')
                ->get(['conversation_id', 'receiver_id', 'body', 'image_url', 'created_at'])->toArray(),
            'friend_requests'  => FriendRequest::where('sender_id', $uid)->orWhere('receiver_id', $uid)->get()->toArray(),
            'marketplace_listings' => MarketplaceListing::where('user_id', $uid)->get()->toArray(),
            'badges'           => UserBadge::where('user_id', $uid)->get(['badge_key', 'unlocked_at'])->toArray(),
        ];

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);

        return response($json, 200, [
            'Content-Type'        => 'application/json; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="fitmeet-data-' . $uid . '-' . now()->format('Y-m-d') . '.json"',
            'Cache-Control'       => 'no-store',
        ]);
    }
}
