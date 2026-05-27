<?php

namespace App\Services;

class GpxRouteParser
{
    public function parse(string $xml): array
    {
        $points = $this->readPoints($xml, 'trkpt|rtept');
        if (empty($points)) {
            $points = $this->readPoints($xml, 'wpt');
        }

        $track = array_map(fn ($point) => [$point['lat'], $point['lng']], $points);
        $elevations = array_map(fn ($point) => $point['ele'], $points);

        $distanceM = 0.0;
        $elevationGain = 0.0;
        $segmentDistanceM = 0.0;
        $segmentStartElevation = $elevations[0] ?? null;
        $maxGrade = 0.0;
        $maxDowngrade = 0.0;

        for ($i = 1; $i < count($track); $i++) {
            $distance = $this->haversineM($track[$i - 1], $track[$i]);
            $distanceM += $distance;
            $segmentDistanceM += $distance;

            $previousElevation = $elevations[$i - 1] ?? null;
            $currentElevation = $elevations[$i] ?? null;

            if ($previousElevation !== null && $currentElevation !== null && $currentElevation > $previousElevation) {
                $elevationGain += $currentElevation - $previousElevation;
            }

            if ($segmentDistanceM >= 50 && $segmentStartElevation !== null && $currentElevation !== null) {
                $grade = (($currentElevation - $segmentStartElevation) / $segmentDistanceM) * 100;
                $maxGrade = max($maxGrade, $grade);
                $maxDowngrade = min($maxDowngrade, $grade);
                $segmentDistanceM = 0.0;
                $segmentStartElevation = $currentElevation;
            }
        }

        return [
            'name' => $this->readName($xml),
            'track' => $track,
            'distance_km' => count($track) >= 2 ? round($distanceM / 1000, 1) : null,
            'elevation_gain' => $elevationGain > 0 ? (int) round($elevationGain) : null,
            'max_grade' => $maxGrade > 0 ? round($maxGrade, 1) : null,
            'max_downgrade' => $maxDowngrade < 0 ? round($maxDowngrade, 1) : null,
            'start' => $track[0] ?? null,
            'end' => ! empty($track) ? $track[array_key_last($track)] : null,
        ];
    }

    private function readPoints(string $xml, string $tagNames): array
    {
        $tagPattern = '/<(?:(?:[^:>\s]+):)?(?:' . $tagNames . ')\b([^>]*)>([\s\S]*?)<\/(?:(?:[^:>\s]+):)?(?:' . $tagNames . ')>|<(?:(?:[^:>\s]+):)?(?:' . $tagNames . ')\b([^>]*)\/>/i';
        preg_match_all($tagPattern, $xml, $matches, PREG_SET_ORDER);

        $points = [];
        foreach ($matches as $match) {
            $attrs = $match[1] ?: ($match[3] ?? '');
            if (! preg_match('/\blat=["\']([^"\']+)["\']/i', $attrs, $latMatch)
                || ! preg_match('/\blon=["\']([^"\']+)["\']/i', $attrs, $lngMatch)) {
                continue;
            }

            $lat = (float) $latMatch[1];
            $lng = (float) $lngMatch[1];
            $ele = null;
            if (preg_match('/<(?:[^:>\s]+:)?ele[^>]*>([\d.+-]+)<\/(?:[^:>\s]+:)?ele>/i', $match[2] ?? '', $eleMatch)) {
                $ele = (float) $eleMatch[1];
            }

            $points[] = ['lat' => $lat, 'lng' => $lng, 'ele' => $ele];
        }

        return $points;
    }

    private function readName(string $xml): ?string
    {
        foreach ([
            '/<trk\b[^>]*>[\s\S]*?<name[^>]*>(.*?)<\/name>[\s\S]*?<\/trk>/i',
            '/<rte\b[^>]*>[\s\S]*?<name[^>]*>(.*?)<\/name>[\s\S]*?<\/rte>/i',
            '/<metadata\b[^>]*>[\s\S]*?<name[^>]*>(.*?)<\/name>[\s\S]*?<\/metadata>/i',
            '/<name[^>]*>(.*?)<\/name>/i',
        ] as $pattern) {
            if (preg_match($pattern, $xml, $match)) {
                $name = trim(html_entity_decode(strip_tags($match[1]), ENT_QUOTES | ENT_XML1, 'UTF-8'));
                if ($name !== '') return mb_substr($name, 0, 140);
            }
        }

        return null;
    }

    private function haversineM(array $a, array $b): float
    {
        $earthRadius = 6371000;
        $lat1 = deg2rad($a[0]);
        $lat2 = deg2rad($b[0]);
        $deltaLat = deg2rad($b[0] - $a[0]);
        $deltaLng = deg2rad($b[1] - $a[1]);

        $x = sin($deltaLat / 2) ** 2
            + cos($lat1) * cos($lat2) * sin($deltaLng / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($x), sqrt(1 - $x));
    }
}
