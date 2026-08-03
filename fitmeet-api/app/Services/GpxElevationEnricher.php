<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Hand-drawn routes have no elevation embedded in their GPX (no GPS/barometer
 * source). Historically every viewer's browser/app fetched elevation for such
 * a track client-side from the free open-meteo API on every single page load,
 * which was easy to rate-limit under normal traffic. This embeds elevation
 * into the stored GPX file itself, once, so it's served pre-baked from then on
 * and clients never need to call open-meteo for it again.
 */
class GpxElevationEnricher
{
    private const MAX_SAMPLE_POINTS = 100;

    /**
     * Reads the GPX file at $path on the public disk, embeds elevation if it's
     * missing, and overwrites the file in place. No-op if the file already has
     * elevation, has too few points, or the elevation lookup fails.
     */
    public function enrichStoredFile(string $path): void
    {
        if (! Storage::disk('public')->exists($path)) {
            return;
        }

        $xml = Storage::disk('public')->get($path);
        $enriched = $this->embed($xml);

        if ($enriched !== null) {
            Storage::disk('public')->put($path, $enriched);
        }
    }

    /**
     * Returns the GPX XML with <ele> tags embedded for a sampled subset of
     * trkpt/rtept points, or null if it already has elevation, has too few
     * points, or the elevation lookup fails.
     */
    public function embed(string $xml): ?string
    {
        if (preg_match('/<(?:[^:>\s]+:)?ele[\s>]/i', $xml)) {
            return null;
        }

        $tagPattern = '/<((?:[^:>\s]+:)?(?:trkpt|rtept))\b([^>]*?)(\/?)>/i';
        if (! preg_match_all($tagPattern, $xml, $matches, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        $total = count($matches[0]);
        if ($total < 2) {
            return null;
        }

        // open-meteo hard-caps requests at 100 coordinates, so this must land
        // on exactly <= MAX_SAMPLE_POINTS regardless of $total - evenly spaced
        // indexes including both endpoints, same approach as the JS client.
        if ($total <= self::MAX_SAMPLE_POINTS) {
            $sampleIndexes = range(0, $total - 1);
        } else {
            $last = $total - 1;
            $sampleIndexes = [];
            for ($i = 0; $i < self::MAX_SAMPLE_POINTS; $i++) {
                $sampleIndexes[] = (int) round(($i / (self::MAX_SAMPLE_POINTS - 1)) * $last);
            }
            $sampleIndexes = array_values(array_unique($sampleIndexes));
        }

        $lats = [];
        $lngs = [];
        foreach ($sampleIndexes as $idx) {
            $attrs = $matches[2][$idx][0];
            if (! preg_match('/\blat=["\']([\d.\-]+)["\']/i', $attrs, $latM)
                || ! preg_match('/\blon=["\']([\d.\-]+)["\']/i', $attrs, $lonM)) {
                return null;
            }
            $lats[] = round((float) $latM[1], 5);
            $lngs[] = round((float) $lonM[1], 5);
        }

        try {
            $response = Http::timeout(10)->get('https://api.open-meteo.com/v1/elevation', [
                'latitude' => implode(',', $lats),
                'longitude' => implode(',', $lngs),
            ]);
        } catch (\Throwable $e) {
            Log::warning('GpxElevationEnricher: elevation request failed', ['error' => $e->getMessage()]);
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $elevations = $response->json('elevation') ?? [];
        if (count($elevations) !== count($sampleIndexes)) {
            return null;
        }

        $eleByIndex = array_combine($sampleIndexes, $elevations);

        // Splice from the end so earlier byte offsets stay valid as we go.
        $result = $xml;
        for ($i = $total - 1; $i >= 0; $i--) {
            if (! isset($eleByIndex[$i])) {
                continue;
            }
            $fullMatch = $matches[0][$i][0];
            $offset = $matches[0][$i][1];
            $tagName = $matches[1][$i][0];
            $attrs = $matches[2][$i][0];
            $selfClosing = $matches[3][$i][0] === '/';
            $ele = round((float) $eleByIndex[$i], 1);

            $replacement = $selfClosing
                ? "<{$tagName}{$attrs}><ele>{$ele}</ele></{$tagName}>"
                : "<{$tagName}{$attrs}><ele>{$ele}</ele>";

            $result = substr_replace($result, $replacement, $offset, strlen($fullMatch));
        }

        return $result;
    }
}
