<?php
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isCrawler = (bool) preg_match(
    '/facebookexternalhit|facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|googlebot|bingbot|rogerbot|embedly|pinterest|vkShare|Iframely|MetaInspector/i',
    $ua
);

$id = trim($_GET['id'] ?? '');
$siteUrl = 'https://fitmeet.fit';

function redirectToShare(string $id): void {
    $target = 'https://fitmeet.fit/market/share/?id=' . rawurlencode($id);
    header('Location: ' . $target, true, 302);
    exit;
}

function curlGet(string $url): ?string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: FitMeetMarketOG/1.0'],
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($res && $code === 200) ? $res : null;
}

if (!$isCrawler || $id === '') {
    redirectToShare($id);
}

$raw = curlGet('https://api.fitmeet.fit/api/market/public/' . rawurlencode($id));
$listing = $raw ? (json_decode($raw, true)['data'] ?? null) : null;

if (!$listing) {
    redirectToShare($id);
}

$price = (float) ($listing['price'] ?? 0);
$type = $listing['type'] ?? 'sell';
$currency = $listing['currency'] ?? 'EUR';
$priceLabel = $price > 0
    ? (($type === 'buy' ? 'up to ' : '') . number_format($price, 0) . ' ' . $currency)
    : ($type === 'buy' ? 'Wanted' : 'For sale');

$conditionMap = ['new' => 'New', 'used' => 'Used', 'like_new' => 'Like new'];
$category = $listing['category']['label'] ?? 'Market';
$condition = $conditionMap[$listing['condition'] ?? ''] ?? null;
$location = implode(', ', array_filter([
    $listing['location']['city'] ?? null,
    $listing['location']['country'] ?? null,
]));

$title = ($listing['title'] ?? 'FitMeet Market') . ' - ' . $priceLabel . ' | FitMeet Market';
$parts = array_filter([
    $priceLabel,
    $category,
    $condition,
    $location,
    $listing['description'] ?? null,
]);
$description = mb_substr(implode(' | ', $parts), 0, 300);
$image = $listing['images'][0] ?? ($siteUrl . '/icon-512.png');
$shareUrl = $siteUrl . '/market/share/og.php?id=' . rawurlencode($id);
$appUrl = $siteUrl . '/market/share/?id=' . rawurlencode($id);

$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');

header('Content-Type: text/html; charset=UTF-8');
echo '<!DOCTYPE html><html><head>';
echo '<meta charset="UTF-8">';
echo '<title>' . $h($title) . '</title>';
echo '<meta name="description" content="' . $h($description) . '">';
echo '<meta property="og:type" content="article">';
echo '<meta property="og:site_name" content="FitMeet">';
echo '<meta property="og:title" content="' . $h($title) . '">';
echo '<meta property="og:description" content="' . $h($description) . '">';
echo '<meta property="og:url" content="' . $h($shareUrl) . '">';
echo '<meta property="og:image" content="' . $h($image) . '">';
echo '<meta property="og:image:width" content="1200">';
echo '<meta property="og:image:height" content="630">';
echo '<meta name="twitter:card" content="summary_large_image">';
echo '<meta name="twitter:title" content="' . $h($title) . '">';
echo '<meta name="twitter:description" content="' . $h($description) . '">';
echo '<meta name="twitter:image" content="' . $h($image) . '">';
echo '<meta http-equiv="refresh" content="0;url=' . $h($appUrl) . '">';
echo '</head><body>';
echo '<h1>' . $h($listing['title'] ?? 'FitMeet Market') . '</h1>';
echo '<p>' . $h($description) . '</p>';
echo '<a href="' . $h($appUrl) . '">Open in FitMeet</a>';
echo '</body></html>';
