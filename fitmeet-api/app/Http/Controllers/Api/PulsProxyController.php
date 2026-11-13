<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Puls statistika preko vlastite domene: skripta i slanje idu na api.fitmeet.fit/api/s/…,
 * pa ih blokeri (Brave Shields, uBlock) ne vide kao tracker treće strane.
 * Bez sesije i kolačića; pravi IP i lokaciju posjetitelja Puls dobiva uz tajni ključ.
 */
class PulsProxyController extends Controller
{
    public function skripta(): Response
    {
        $js = Cache::remember('puls:skripta', now()->addHours(6), function () {
            try {
                $r = Http::timeout(5)->get(config('services.puls.url') . '/p.js');

                return $r->successful() ? $r->body() : null;
            } catch (Throwable) {
                return null;
            }
        }) ?? '';

        return response($js, 200, ['Content-Type' => 'text/javascript; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    public function dogadaj(Request $request): Response
    {
        $kljuc = config('services.puls.key');
        $tijelo = $request->getContent();
        if ($kljuc && strlen($tijelo) <= 4000) {
            try {
                Http::timeout(3)->withHeaders(array_filter([
                    'User-Agent' => (string) $request->userAgent(),
                    'Origin' => $request->header('Origin'),
                    'Referer' => $request->header('Referer'),
                    'X-Puls-Key' => $kljuc,
                    'X-Puls-Ip' => $request->header('CF-Connecting-IP') ?: $request->ip(),
                    'X-Puls-Country' => $request->header('CF-IPCountry'),
                    'X-Puls-City' => $request->header('CF-IPCity'),
                ]))->withBody($tijelo, 'text/plain')->post(config('services.puls.url') . '/api/e');
            } catch (Throwable) {
                // statistika nikad ne smije srušiti stranicu
            }
        }

        return response()->noContent();
    }
}
