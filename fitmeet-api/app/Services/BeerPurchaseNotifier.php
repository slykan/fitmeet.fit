<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Broadcasts a fun "X just bought N beers" push to everyone whenever someone
 * buys a beer (web PayPal or mobile IAP donation), with Buy beer / See rank
 * action buttons. Throttled so a burst of donations doesn't spam everyone.
 */
class BeerPurchaseNotifier
{
    private const THROTTLE_MINUTES = 10;

    private const WEIGHTS = [
        'beer_small'  => 1,
        'beer_medium' => 2,
        'beer_large'  => 3,
    ];

    public function notify(User $buyer, string $productId): void
    {
        if (! Cache::add('beer_purchase_notify_lock', true, now()->addMinutes(self::THROTTLE_MINUTES))) {
            return;
        }

        $count = self::WEIGHTS[$productId] ?? 1;
        $body = "{$buyer->name} just bought {$count}x " . ($count === 1 ? 'beer' : 'beers') . '. Cheers! 🍻';
        $title = '🍻 Cheers!';

        $recipientIds = User::query()
            ->where('id', '!=', $buyer->id)
            ->pluck('id')
            ->all();

        if (empty($recipientIds)) {
            return;
        }

        SendPushNotification::dispatch(
            $recipientIds,
            $title,
            $body,
            [
                'type'       => 'beer_purchased',
                'categoryId' => 'beer_purchased',
                'channelId'  => 'beer_purchased',
                '_data_only' => 'true',
                '_title'     => $title,
                '_body'      => $body,
            ],
        );
    }
}
