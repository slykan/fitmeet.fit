<?php
$appRoot = '/home/fitmeet/public_html/api.fitmeet.fit';
require $appRoot . '/vendor/autoload.php';
$app = require $appRoot . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Event;

// Confirmed test/placeholder accounts: John/Jane Doe, "Nuage Laboratoire" (Google
// Play automated pre-launch test-lab accounts), generic "Test User", and one
// "Alka test" tied to the dev's own gmail used for early testing. Excludes id 239
// ("Alan Tester", created today) pending separate confirmation.
$ids = [2, 7, 17, 20, 24, 26, 27, 29, 32, 36, 37, 38, 58, 60, 65, 106, 236];

foreach ($ids as $id) {
    $user = User::find($id);
    if (!$user) {
        echo "#{$id}: not found, skipping\n";
        continue;
    }
    $name = $user->name;

    $organizedEvents = Event::where('user_id', $id)->get(['id', 'title']);
    foreach ($organizedEvents as $e) {
        $e->delete();
        echo "  deleted organized event #{$e->id} \"{$e->title}\"\n";
    }

    $user->delete();
    echo "#{$id} ({$name}): deleted\n";
}

echo "done\n";
