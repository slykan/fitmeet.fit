<?php

namespace App\Jobs;

use App\Models\ProviderConnection;
use App\Models\Training;
use App\Services\StravaClient;
use App\Services\StravaDetailImporter;
use App\Services\TrainingSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Fetch a Strava training's full detail (splits, laps, efforts, power…) and streams
 * (charts). Background imports back off well before Strava's rate limit so live
 * webhooks keep working; a 429 just reschedules.
 */
class FetchStravaTrainingDetails implements ShouldQueue
{
    use Queueable;

    public int $tries = 20;

    public function __construct(
        public readonly int $trainingId,
        public readonly bool $background = true,
    ) {}

    public function handle(StravaClient $strava, StravaDetailImporter $importer, TrainingSyncService $sync): void
    {
        $training = Training::with('detail')->find($this->trainingId);
        if (!$training || $training->provider !== 'strava') {
            return;
        }
        $detail = $training->detail;
        if ($detail?->details_fetched_at && $detail?->streams_fetched_at) {
            return;
        }

        if ($this->background && ($wait = $strava->backgroundWaitSeconds()) > 0) {
            $this->release($wait);
            return;
        }

        $connection = ProviderConnection::where('user_id', $training->user_id)->where('provider', 'strava')->first();
        $token = $connection ? $strava->freshToken($connection) : null;
        if (!$token) {
            return; // disconnected / revoked — nothing to fetch with
        }

        if (!$detail?->details_fetched_at) {
            $res = $strava->get($token, "activities/{$training->external_id}");
            if ($res->status() === 429) {
                $this->release(16 * 60);
                return;
            }
            if ($res->status() === 404) {
                return; // deleted on Strava
            }
            if ($res->successful()) {
                // The detail also carries calories, gear… the summary list lacks.
                $sync->storeStravaActivity($training->user, $res->json());
                $importer->storeDetails($training, $res->json());
            }
        }

        if (!$detail?->streams_fetched_at) {
            $res = $strava->get($token, "activities/{$training->external_id}/streams", [
                'keys'        => implode(',', StravaDetailImporter::STREAM_KEYS),
                'key_by_type' => 'true',
            ]);
            if ($res->status() === 429) {
                $this->release(16 * 60);
                return;
            }
            if ($res->successful()) {
                $importer->storeStreams($training, $res->json() ?? []);
            } elseif ($res->status() === 404) {
                // Manual entries have no streams — mark as done so we don't retry forever.
                $importer->storeStreams($training, []);
            }
        }
    }
}
