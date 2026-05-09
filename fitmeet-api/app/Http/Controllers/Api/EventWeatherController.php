<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class EventWeatherController extends Controller
{
    public function snapshots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_ids' => ['required', 'array', 'min:1', 'max:30'],
            'event_ids.*' => ['integer'],
        ]);

        $eventIds = collect($validated['event_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $events = Event::query()
            ->whereIn('id', $eventIds)
            ->get([
                'id',
                'lat',
                'lng',
                'start_at',
                'timezone',
                'status',
            ])
            ->keyBy('id');

        $snapshots = [];

        foreach ($eventIds as $eventId) {
            /** @var Event|null $event */
            $event = $events->get($eventId);
            if (! $event || $event->lat === null || $event->lng === null || ! $event->start_at) {
                $snapshots[(string) $eventId] = null;
                continue;
            }

            $snapshots[(string) $eventId] = $this->snapshotForEvent($event);
        }

        return response()->json(['data' => $snapshots]);
    }

    private function snapshotForEvent(Event $event): ?array
    {
        $eventTime = $event->start_at->copy()->timezone($event->timezone ?? config('app.event_timezone'));
        $cacheKey = sprintf(
            'event_weather:%s:%s:%s',
            number_format((float) $event->lat, 2, '.', ''),
            number_format((float) $event->lng, 2, '.', ''),
            $eventTime->format('Y-m-d-H')
        );

        return Cache::remember($cacheKey, $this->ttlFor($eventTime), function () use ($event, $eventTime) {
            return $this->fetchSnapshot(
                (float) $event->lat,
                (float) $event->lng,
                $eventTime->format('Y-m-d'),
                (int) $eventTime->format('G'),
                $eventTime->getTimezone()->getName(),
            );
        });
    }

    private function ttlFor(Carbon $eventTime): int
    {
        $hoursUntil = now()->diffInHours($eventTime, false);

        if ($hoursUntil <= 24) {
            return 60 * 60;
        }

        if ($hoursUntil <= 72) {
            return 3 * 60 * 60;
        }

        if ($hoursUntil <= 168) {
            return 6 * 60 * 60;
        }

        return 12 * 60 * 60;
    }

    private function fetchSnapshot(float $lat, float $lng, string $isoDate, int $hour, string $timezone): ?array
    {
        try {
            $response = Http::timeout(10)->acceptJson()->get('https://api.open-meteo.com/v1/forecast', [
                'latitude' => $lat,
                'longitude' => $lng,
                'hourly' => 'temperature_2m,weathercode,windspeed_10m,winddirection_10m,uv_index,cloudcover,precipitation',
                'daily' => 'temperature_2m_max,temperature_2m_min',
                'timezone' => $timezone,
                'start_date' => $isoDate,
                'end_date' => $isoDate,
            ]);

            if (! $response->successful()) {
                return null;
            }

            $data = $response->json();
            $targetTime = sprintf('%sT%02d:00', $isoDate, $hour);
            $times = data_get($data, 'hourly.time', []);
            $index = array_search($targetTime, $times, true);

            if ($index === false) {
                return null;
            }

            return [
                'code' => (int) data_get($data, "hourly.weathercode.$index", 0),
                'temperature' => (int) round((float) data_get($data, "hourly.temperature_2m.$index", 0)),
                'tempMin' => (int) round((float) data_get($data, 'daily.temperature_2m_min.0', 0)),
                'tempMax' => (int) round((float) data_get($data, 'daily.temperature_2m_max.0', 0)),
                'windSpeed' => (int) round((float) data_get($data, "hourly.windspeed_10m.$index", 0)),
                'windDir' => (int) round((float) data_get($data, "hourly.winddirection_10m.$index", 0)),
                'uvIndex' => round((float) data_get($data, "hourly.uv_index.$index", 0), 1),
                'cloudCover' => (int) round((float) data_get($data, "hourly.cloudcover.$index", 0)),
                'precipitation' => round((float) data_get($data, "hourly.precipitation.$index", 0), 1),
                'updated_at' => now()->toIso8601String(),
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}
