<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPushToken;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\AndroidConfig;
use Kreait\Firebase\Messaging\ApnsConfig;
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

        $dataOnly = ($payload['_data_only'] ?? '') === 'true';
        $categoryId = $payload['categoryId'] ?? null;

        foreach ($tokens->chunk(500) as $chunk) {
            if ($dataOnly) {
                // Data-only message: Expo background task handles display + categories
                $message = CloudMessage::new()
                    ->withData($payload)
                    ->withAndroidConfig(AndroidConfig::fromArray(['priority' => 'high']))
                    ->withApnsConfig(ApnsConfig::fromArray([
                        'headers' => ['apns-priority' => '10', 'apns-push-type' => 'background'],
                        'payload' => ['aps' => [
                            'content-available' => 1,
                            'category'          => $categoryId ?? '',
                        ]],
                    ]));
            } else {
                $notification = Notification::create($title, $body);
                $message = CloudMessage::new()
                    ->withNotification($notification)
                    ->withData($payload);
            }

            try {
                $report = $this->messaging->sendMulticast($message, $chunk->all());
            } catch (\Throwable $e) {
                Log::warning('Push notification multicast send failed', [
                    'title' => $title,
                    'token_count' => $chunk->count(),
                    'exception' => $e->getMessage(),
                ]);
                continue;
            }

            $deadTokens = array_merge($report->unknownTokens(), $report->invalidTokens());
            if (! empty($deadTokens)) {
                UserPushToken::query()->whereIn('token', $deadTokens)->delete();
            }

            if ($report->hasFailures()) {
                $otherFailures = $report->failures()->filter(
                    fn ($item) => ! in_array($item->target()->value(), $deadTokens, true)
                );

                if ($otherFailures->count() > 0) {
                    Log::warning('Push notification delivery failures', [
                        'title' => $title,
                        'dead_tokens_pruned' => count($deadTokens),
                        'other_failures' => $otherFailures->map(
                            fn ($item) => $item->error()?->getMessage()
                        ),
                    ]);
                }
            }
        }
    }
}
