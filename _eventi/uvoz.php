<?php
/**
 * Uvoz javnih evenata na poslužitelju (tinker): organizator = slynetwork@gmail.com, bez push obavijesti
 * i bez objave u feedu. Idempotentno po client_request_id = "import-<ključ>".
 * Očekuje ~/eventi-uvoz/eventi.json i ~/eventi-uvoz/<kategorija>.jpg
 */
use App\Models\Event;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

$dir = getenv('HOME') . '/eventi-uvoz';
$eventi = json_decode(file_get_contents("$dir/eventi.json"), true);
$org = User::where('email', 'slynetwork@gmail.com')->firstOrFail();

$trajanje = function (array $e): int {
    if ($e['kat'] === 'music') return 180;
    if ($e['kat'] === 'party') return str_starts_with($e['kljuc'], 'docek') ? 360 : 240;
    if ($e['kat'] === 'fitness') return 600;
    return match (true) {
        str_contains($e['kljuc'], 'ultra') || $e['kljuc'] === 'halfyard-mura' => 720,
        str_contains($e['kljuc'], 'trail') || in_array($e['kljuc'], ['omiska-transverzala', 'papuk-trail'], true) => 300,
        str_contains($e['naslov'], 'polumaraton') || str_contains(mb_strtolower($e['naslov']), 'half') => 180,
        default => 120,
    };
};

$novih = 0;
$preskoceno = 0;
foreach ($eventi as $e) {
    $crid = 'import-' . $e['kljuc'];
    if (Event::where('user_id', $org->id)->where('client_request_id', $crid)->exists()) {
        $preskoceno++;
        continue;
    }
    $start = Carbon::parse($e['datum'] . ' ' . $e['vrijeme'], 'Europe/Zagreb');
    if ($start->isPast()) {
        $preskoceno++;
        continue;
    }
    $opis = $e['opis'];
    if ($e['kat'] === 'music' && $e['kljuc'] !== 'arena-andre-rieu') {
        $opis .= ' Satnica je okvirna — provjeri na ulaznici.';
    }
    $opis .= "\n\nViše informacija i prijave: " . $e['url'];
    // svaki event dobiva vlastitu kopiju naslovnice (brisanje eventa briše i njegovu sliku)
    $slika = 'event-images/fitmeet-' . $e['kljuc'] . '.jpg';
    Storage::disk('public')->put($slika, file_get_contents("$dir/" . $e['kat'] . '.jpg'));

    Event::create([
        'user_id' => $org->id,
        'client_request_id' => $crid,
        'title' => mb_substr($e['naslov'], 0, 100),
        'description' => mb_substr($opis, 0, 2000),
        'category' => $e['kat'],
        'lat' => $e['geo']['lat'],
        'lng' => $e['geo']['lng'],
        'address' => preg_replace('/,\s*Croatia$/', '', $e['lokacija']),
        'timezone' => 'Europe/Zagreb',
        'start_at' => $start->copy()->utc(),
        'duration_minutes' => $trajanje($e),
        'image_path' => $slika,
        'link_url' => $e['url'],
        'is_private' => false,
        'status' => 'active',
    ]);
    $novih++;
}
echo "Novih evenata: $novih, preskočeno (već postoji ili prošlo): $preskoceno\n";
