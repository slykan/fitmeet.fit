<?php

namespace App\Jobs;

use App\Services\PushNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendPushNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @param  array<int>  $userIds
     * @param  array<string, scalar|null>  $data
     */
    public function __construct(
        public readonly array $userIds,
        public readonly string $title,
        public readonly string $body,
        public readonly array $data = [],
    ) {
    }

    public function handle(PushNotificationService $pushNotifications): void
    {
        $pushNotifications->sendToUserIds(
            $this->userIds,
            $this->title,
            $this->body,
            $this->data,
        );
    }
}
