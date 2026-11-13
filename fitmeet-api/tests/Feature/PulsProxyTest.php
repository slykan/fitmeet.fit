<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PulsProxyTest extends TestCase
{
    public function test_dogadaj_ide_pulsu_s_kljucem_i_ip_adresom_bez_kolacica(): void
    {
        config(['services.puls.key' => 'tajna', 'services.puls.url' => 'https://puls.test']);
        Http::fake(['puls.test/*' => Http::response('', 204)]);

        $r = $this->call('POST', '/api/s/e', [], [], [], ['REMOTE_ADDR' => '93.142.0.1', 'HTTP_USER_AGENT' => 'Mozilla/5.0 Chrome', 'HTTP_ORIGIN' => 'https://fitmeet.fit', 'CONTENT_TYPE' => 'text/plain'],
            '{"s":"abc","e":"pv","u":"https://fitmeet.fit/"}');

        $r->assertNoContent();
        $this->assertEmpty($r->headers->getCookies());
        Http::assertSent(fn (HttpRequest $h) => $h->url() === 'https://puls.test/api/e'
            && $h->header('X-Puls-Key')[0] === 'tajna' && $h->header('X-Puls-Ip')[0] === '93.142.0.1'
            && $h->header('Origin')[0] === 'https://fitmeet.fit' && str_contains($h->body(), '"u":"https://fitmeet.fit/"'));
    }

    public function test_bez_kljuca_nista_ne_salje(): void
    {
        config(['services.puls.key' => null]);
        Http::fake();
        $this->call('POST', '/api/s/e', [], [], [], ['CONTENT_TYPE' => 'text/plain'], '{"s":"abc"}')->assertNoContent();
        Http::assertNothingSent();
    }

    public function test_skripta_s_vlastite_domene(): void
    {
        config(['services.puls.url' => 'https://puls.test']);
        Http::fake(['puls.test/p.js' => Http::response('/* puls */', 200)]);
        $this->get('/api/s/app.js')->assertOk()->assertHeader('Content-Type', 'text/javascript; charset=utf-8')->assertSee('/* puls */', false);
    }
}
