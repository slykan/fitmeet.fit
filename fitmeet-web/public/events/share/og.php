<?php
$ua        = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isCrawler = (bool) preg_match(
    '/facebookexternalhit|facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|googlebot|bingbot|rogerbot|embedly|pinterest|vkShare|Iframely|MetaInspector/i',
    $ua
);

$id      = trim($_GET['id'] ?? '');
$siteUrl = 'https://fitmeet.fit';

function serveStatic(): void {
    $html = file_get_contents(__DIR__ . '/index.html');
    header('Content-Type: text/html; charset=UTF-8');
    echo $html ?: '';
    exit;
}

function curlGet(string $url): ?string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ['Accept: application/json', 'User-Agent: FitMeetOGBot/1.0'],
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($res && $code === 200) ? $res : null;
}

if (!$isCrawler || $id === '') {
    serveStatic();
}

$raw   = curlGet('https://api.fitmeet.fit/api/events/public/' . rawurlencode($id));
$event = $raw ? (json_decode($raw, true)['data'] ?? null) : null;

if (!$event) {
    serveStatic();
}

// ── Title ────────────────────────────────────────────────────────────────────
$title = $event['title'] . ' | FitMeet';

// ── Description ──────────────────────────────────────────────────────────────
$startAt = $event['schedule']['start_at'] ?? '';
$dateStr = '';
if ($startAt) {
    $dt      = new DateTime($startAt);
    $dateStr = $dt->format('D, j M Y · H:i');
}

$dur  = $event['schedule']['duration_minutes'] ?? null;
$act  = $event['activity'] ?? [];
$cnt  = $event['participants_count'] ?? 0;
$max  = $event['max_participants'] ?? null;

$parts = [];
$parts[] = $event['category']['label'];
if ($dateStr)                    $parts[] = $dateStr;
if ($dur)                        $parts[] = $dur . ' min';
if (!empty($act['distance_km'])) $parts[] = $act['distance_km'] . ' km';
if (!empty($act['elevation_gain'])) $parts[] = '↑' . $act['elevation_gain'] . ' m';
if (!empty($act['pace']))        $parts[] = $act['pace'];
if (!empty($event['skill_level'])) $parts[] = ucfirst($event['skill_level']);
$parts[] = $cnt . ($max ? '/' . $max : '') . ' going';
if (!empty($event['description'])) $parts[] = $event['description'];

$description = mb_substr(implode(' · ', $parts), 0, 300);

// ── Image ────────────────────────────────────────────────────────────────────
$lat   = $event['location']['lat'] ?? null;
$lng   = $event['location']['lng'] ?? null;
$image = $siteUrl . '/logo_full.png';

if ($lat && $lng) {
    $z = 14;
    $x = (int) floor(($lng + 180) / 360 * (1 << $z));
    $y = (int) floor((1 - log(tan(deg2rad($lat)) + 1 / cos(deg2rad($lat))) / M_PI) / 2 * (1 << $z));
    $image = "https://tile.openstreetmap.org/{$z}/{$x}/{$y}.png";
}

// ── Output ───────────────────────────────────────────────────────────────────
$h        = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$shareUrl = $siteUrl . '/events/share/?id=' . rawurlencode($id);
$appUrl   = $siteUrl . '/events/view?id='   . rawurlencode($id);

header('Content-Type: text/html; charset=UTF-8');
echo '<!DOCTYPE html><html><head>';
echo '<meta charset="UTF-8">';
echo '<title>' . $h($title) . '</title>';
echo '<meta name="description" content="' . $h($description) . '">';
echo '<meta property="og:type"         content="article">';
echo '<meta property="og:site_name"    content="FitMeet">';
echo '<meta property="og:title"        content="' . $h($title) . '">';
echo '<meta property="og:description"  content="' . $h($description) . '">';
echo '<meta property="og:url"          content="' . $h($shareUrl) . '">';
echo '<meta property="og:image"        content="' . $h($image) . '">';
echo '<meta property="og:image:width"  content="256">';
echo '<meta property="og:image:height" content="256">';
echo '<meta name="twitter:card"        content="summary_large_image">';
echo '<meta name="twitter:title"       content="' . $h($title) . '">';
echo '<meta name="twitter:description" content="' . $h($description) . '">';
echo '<meta name="twitter:image"       content="' . $h($image) . '">';
echo '<meta http-equiv="refresh" content="0;url=' . $h($shareUrl) . '">';
echo '</head><body>';
echo '<h1>' . $h($event['title']) . '</h1>';
echo '<p>' . $h($description) . '</p>';
echo '<a href="' . $h($appUrl) . '">Open in FitMeet</a>';
echo '</body></html>';
