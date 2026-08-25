<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\User;
use App\Models\UserPushToken;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function __construct(private readonly PushNotificationService $push) {}

    public function broadcasts(): JsonResponse
    {
        $announcements = Announcement::with(['sender:id,name', 'targetUser:id,name'])
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($a) => [
                'id'              => $a->id,
                'title'           => $a->title,
                'body'            => $a->body,
                'data'            => $a->data,
                'target_platform' => $a->target_platform,
                'target_country'  => $a->target_country,
                'target_user'     => $a->targetUser?->name,
                'sent_by'         => $a->sender?->name,
                'created_at'      => $a->created_at,
            ]);

        return response()->json($announcements);
    }

    public function broadcast(Request $request): JsonResponse
    {
        $request->validate([
            'title'           => 'required|string|max:120',
            'body'            => 'required|string|max:500',
            'data'            => 'nullable|array',
            'target_platform' => 'nullable|in:android,ios,web',
            'target_country'  => 'nullable|string|max:64',
            'target_user_id'  => 'nullable|exists:users,id',
        ]);

        $announcement = Announcement::create([
            'sent_by'         => $request->user()->id,
            'title'           => $request->title,
            'body'            => $request->body,
            'data'            => $request->data,
            'target_platform' => $request->target_user_id ? null : $request->target_platform,
            'target_country'  => $request->target_user_id ? null : $request->target_country,
            'target_user_id'  => $request->target_user_id,
        ]);

        // Web-only announcements don't need a push — they'll appear via GET /notifications
        if ($request->target_user_id || $request->target_platform !== 'web') {
            $userIds = $request->target_user_id
                ? collect([$request->target_user_id])
                : $this->resolveTargetUserIds(
                    $request->target_platform,
                    $request->target_country,
                );

            $this->push->sendToUserIds(
                $userIds,
                $request->title,
                $request->body,
                array_merge(
                    ['type' => 'announcement', 'announcement_id' => (string) $announcement->id],
                    $request->data ?? [],
                ),
            );
        }

        return response()->json(['id' => $announcement->id], 201);
    }

    public function countries(): JsonResponse
    {
        $countries = User::whereNotNull('home_country')
            ->where('home_country', '!=', '')
            ->distinct()
            ->orderBy('home_country')
            ->pluck('home_country');

        return response()->json($countries);
    }

    private function resolveTargetUserIds(?string $platform, ?string $country): \Illuminate\Support\Collection
    {
        $query = User::query();

        if ($country) {
            $query->where('home_country', $country);
        }

        if ($platform) {
            // Only users who have a push token for this platform
            $query->whereHas('pushTokens', fn ($q) => $q->where('platform', $platform));
        }

        return $query->pluck('id');
    }
}
