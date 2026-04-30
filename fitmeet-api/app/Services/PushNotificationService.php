<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPushToken;
use Illuminate\Support\Collection;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

class PushNotificationService
{
    public function __construct(
        private readonly Messaging $messaging,
    ) {
    }

    /**
     * @param  iterable<int>  $userIds
     * @param  array<string, scalar|null>  $data
     */
    public function sendToUserIds(iterable $userIds, string $title, string $body, array $data = []): void
    {
        $ids = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $tokens = UserPushToken::query()
            ->whereIn('user_id', $ids)
            ->whereHas('user', fn ($query) => $query->where('push_notifications', true))
            ->pluck('token')
            ->filter()
            ->unique()
            ->values();

        $this->sendToTokens($tokens, $title, $body, $data);
    }

    public function sendToUser(User $user, string $title, string $body, array $data = []): void
    {
        $this->sendToUserIds([$user->id], $title, $body, $data);
    }

    /**
     * @param  Collection<int, string>  $tokens
     * @param  array<string, scalar|null>  $data
     */
    private function sendToTokens(Collection $tokens, string $title, string $body, array $data = []): void
    {
        if ($tokens->isEmpty()) {
            return;
        }

        $payload = collect($data)
            ->filter(fn ($value) => $value !== null)
            ->map(fn ($value) => (string) $value)
            ->all();

        $notification = Notification::create($title, $body);

        foreach ($tokens->chunk(500) as $chunk) {
            $message = CloudMessage::new()
                ->withNotification($notification)
                ->withData($payload);

            try {
                $this->messaging->sendMulticast($message, $chunk->all());
            } catch (\Throwable) {
                // Ignore single-batch failures for now; notification channels remain best-effort.
            }
        }
    }
}
