<?php

namespace App\Jobs;

use App\Models\ProviderConnection;
use App\Services\HuaweiSyncService;
use App\Services\TrainingSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

// Dispatched (delayed ~2 minutes) from HuaweiController::connect() when the
// immediate post-connect backfill comes back empty, since Huawei's cloud
// activity data can lag briefly right after a fresh OAuth grant.
class RetryHuaweiBackfill implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $connectionId)
    {
    }

    public function handle(HuaweiSyncService $huawei, TrainingSyncService $sync): void
    {
        $connection = ProviderConnection::find($this->connectionId);
        if (!$connection || $connection->provider !== 'huawei') {
            return;
        }

        $huawei->backfillHuawei($connection, $sync);
    }
}
