<?php
/**
 * OG meta proxy for /events/share?id=X
 * Serves static HTML to regular users, dynamic OG tags to social crawlers.
 */

$ua        = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isCrawler = (bool) preg_match(
    '/facebookexternalhit|facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|googlebot|bingbot|rogerbot|embedly|pinterest|vkShare|Iframely|MetaInspector/i',
    $ua
);

$id      = trim($_GET['id'] ?? '');
$siteUrl = 'https://fitmeet.fit';

// Regular user — serve the static Next.js page
if (!$isCrawler || $id === '') {
    $html = @file_get_contents(__DIR__ . '/index.html');
    header('Content-Type: text/html; charset=UTF-8');
    echo $html ?: '';
    exit;
}

// Social crawler — fetch event from API
$apiUrl = 'https://api.fitmeet.fit/api/events/public/' . rawurlencode($id);
$ctx = stream_context_create([
    'http' => [
        'timeout'       => 5,
        'ignore_errors' => true,
        'header'        => "Accept: application/json\r\nUser-Agent: FitMeetOGBot/1.0\r\n",
    ],
    'ssl' => ['verify_peer' => false],
]);

$raw   = @file_get_contents($apiUrl, false, $ctx);
$event = $raw ? (json_decode($raw, true)['data'] ?? null) : null;

// Fallback to static page if event not found
if (!$event) {
    $html = @file_get_contents(__DIR__ . '/index.html');
    header('Content-Type: text/html; charset=UTF-8');
    echo $html ?: '';
    exit;
}

// ── Build title ──────────────────────────────────────────────────────────────
$title = $event['title'] . ' | FitMeet';

// ── Build description ────────────────────────────────────────────────────────
$startAt  = $event['schedule']['start_at'] ?? '';
$dateStr  = '';
$timeStr  = '';
if ($startAt) {
    $dt      = new DateTime($startAt);
    $dateStr = $dt->format('D, j M Y');
    $timeStr = $dt->format('H:i');
}

$dur = $event['schedule']['duration_minutes'] ?? null;

$parts = [];
$parts[] = $event['category']['label'];
if ($dateStr) $parts[] = $dateStr . ($timeStr ? ' · ' . $timeStr : '');
if ($dur)     $parts[] = $dur . ' min';

$act = $event['activity'] ?? [];
if (!empty($act['distance_km']))    $parts[] = $act['distance_km'] . ' km';
if (!empty($act['elevation_gain'])) $parts[] = '↑' . $act['elevation_gain'] . ' m';
if (!empty($act['pace']))           $parts[] = $act['pace'];
if (!empty($event['skill_level']))  $parts[] = ucfirst($event['skill_level']);

$cnt = $event['participants_count'] ?? 0;
$max = $event['max_participants']   ?? null;
$parts[] = $cnt . ($max ? '/' . $max : '') . ' going';

if (!empty($event['description'])) {
    $parts[] = $event['description'];
}

$description = mb_substr(implode(' · ', $parts), 0, 300);

// ── Image ────────────────────────────────────────────────────────────────────
$lat   = $event['location']['lat'] ?? null;
$lng   = $event['location']['lng'] ?? null;
$image = $siteUrl . '/logo_full.png';

if ($lat && $lng) {
    // Free static map via OpenStreetMap tile — single tile centered on event
    // Calculate tile x/y for zoom 14
    $zoom = 14;
    $x    = (int) floor(($lng + 180) / 360 * pow(2, $zoom));
    $y    = (int) floor((1 - log(tan(deg2rad($lat)) + 1 / cos(deg2rad($lat))) / M_PI) / 2 * pow(2, $zoom));
    // Use maptiler for a 600x315 image (free, no key for raster tiles)
    $image = "https://tile.openstreetmap.org/{$zoom}/{$x}/{$y}.png";
}

// ── Escape for HTML ──────────────────────────────────────────────────────────
$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');

$shareUrl = $siteUrl . '/events/share/?id=' . rawurlencode($id);
$appUrl   = $siteUrl . '/events/view?id='   . rawurlencode($id);

echo '<!DOCTYPE html><html><head>';
echo '<meta charset="UTF-8">';
echo '<title>' . $h($title) . '</title>';
echo '<meta name="description" content="' . $h($description) . '">';

// Open Graph
echo '<meta property="og:type"        content="article">';
echo '<meta property="og:site_name"   content="FitMeet">';
echo '<meta property="og:title"       content="' . $h($title) . '">';
echo '<meta property="og:description" content="' . $h($description) . '">';
echo '<meta property="og:url"         content="' . $h($shareUrl) . '">';
echo '<meta property="og:image"       content="' . $h($image) . '">';
echo '<meta property="og:image:width" content="600">';
echo '<meta property="og:image:height" content="315">';

// Twitter / X
echo '<meta name="twitter:card"        content="summary_large_image">';
echo '<meta name="twitter:title"       content="' . $h($title) . '">';
echo '<meta name="twitter:description" content="' . $h($description) . '">';
echo '<meta name="twitter:image"       content="' . $h($image) . '">';

// Instant redirect for crawlers that follow JS
echo '<meta http-equiv="refresh" content="0;url=' . $h($shareUrl) . '">';
echo '</head><body>';
echo '<h1>' . $h($event['title']) . '</h1>';
echo '<p>' . $h($description) . '</p>';
echo '<a href="' . $h($appUrl) . '">Open in FitMeet</a>';
echo '</body></html>';
