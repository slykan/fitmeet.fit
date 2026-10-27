<?php
/**
 * Priprema javnih evenata: satnica (sa stranice izvora gdje nedostaje) i koordinate (OpenStreetMap Nominatim,
 * 1 upit u sekundi, rezultati u cache). Ispis: eventi.json + pregled.txt.   php _eventi/pripremi.php
 */
declare(strict_types=1);
$dir = __DIR__;
$popis = require "$dir/popis.php";
@mkdir("$dir/cache", 0775, true);

function dohvati(string $url, string $cache): string
{
    if (is_file($cache)) {
        return (string) file_get_contents($cache);
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 25,
        CURLOPT_USERAGENT => 'FitMeet event import (slynetwork@gmail.com)', CURLOPT_HTTPHEADER => ['Accept-Language: hr,en']]);
    $r = (string) curl_exec($ch);
    curl_close($ch);
    file_put_contents($cache, $r);
    return $r;
}

/** Vrijeme iz teksta stranice utrke: „u 19:00", „start 19.30 h", „19:00 h"… */
function vrijeme_iz(string $html): ?string
{
    $t = html_entity_decode(strip_tags((string) preg_replace('#<(script|style)\b.*?</\1>#s', '', $html)), ENT_QUOTES, 'UTF-8');
    $t = preg_replace('/\s+/u', ' ', $t);
    if (preg_match('/(?:start|starta|početak|pocetak|u)\s*(?:je\s*)?(?:u\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:h|sati)?/iu', $t, $m)) {
        return sprintf('%02d:%s', $m[1], $m[2]);
    }
    return null;
}

$ishod = [];
$pregled = [];
foreach ($popis as [$kljuc, $naslov, $kat, $datum, $vrijeme, $lokacija, $opis, $url]) {
    $izvorVremena = $vrijeme ? 'popis' : null;
    if (!$vrijeme && str_contains($url, 'runners.hr')) {
        $vrijeme = vrijeme_iz(dohvati($url, "$dir/cache/runners-$kljuc.html"));
        $izvorVremena = $vrijeme ? 'stranica' : null;
    }
    // koordinate: najprije puna lokacija, pa samo mjesto
    $geo = null;
    foreach (array_unique([$lokacija, preg_replace('/^[^,]+,\s*/', '', $lokacija)]) as $upit) {
        $cache = "$dir/cache/geo-" . md5($upit) . '.json';
        $novo = !is_file($cache);
        $j = json_decode(dohvati('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=hr,it,si,rs,ba,hu,me,at&q=' . rawurlencode($upit), $cache), true);
        if ($novo) {
            usleep(1100000); // pravila Nominatima: najviše 1 upit u sekundi
        }
        if (!empty($j[0]['lat'])) {
            $geo = ['lat' => round((float) $j[0]['lat'], 6), 'lng' => round((float) $j[0]['lon'], 6), 'upit' => $upit, 'naziv' => $j[0]['display_name']];
            break;
        }
    }
    $ishod[] = compact('kljuc', 'naslov', 'kat', 'datum', 'vrijeme', 'lokacija', 'opis', 'url', 'geo') + ['izvor_vremena' => $izvorVremena];
    $pregled[] = sprintf('%s %-5s %-8s %-48s %s', $datum, $vrijeme ?? '??:??', $kat, mb_substr($naslov, 0, 48), $geo ? sprintf('%.4f,%.4f (%s)', $geo['lat'], $geo['lng'], $geo['upit'] === $lokacija ? 'točno' : 'samo mjesto') : 'NEMA KOORDINATA');
}
file_put_contents("$dir/eventi.json", json_encode($ishod, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
file_put_contents("$dir/pregled.txt", implode("\n", $pregled) . "\n");
echo implode("\n", $pregled) . "\n";
