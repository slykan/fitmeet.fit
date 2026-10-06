<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RetryHuaweiBackfill;
use App\Models\ProviderAuthorizationEvent;
use App\Models\ProviderConnection;
use App\Models\Training;
use App\Services\HuaweiSyncService;
use App\Services\TrainingSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HuaweiController
{
    private function exchangeCode(string $code): ?array
    {
        $res = Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/token', [
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'client_id'     => config('services.huawei.client_id'),
            'client_secret' => config('services.huawei.client_secret'),
            'redirect_uri'  => config('services.huawei.redirect_uri'),
        ]);

        return $res->successful() ? $res->json() : null;
    }

    // Huawei's token response carries the user's identity in the id_token (a JWT) rather
    // than as a plain field — decode its payload (no signature check needed, it came
    // straight from Huawei's own token endpoint over TLS) and fall back to openID/unionID
    // in case a given response shape includes those directly instead.
    private function extractOpenId(array $tokenData): ?string
    {
        if (!empty($tokenData['id_token'])) {
            $parts = explode('.', $tokenData['id_token']);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                if (!empty($payload['sub'])) {
                    return (string) $payload['sub'];
                }
            }
        }

        return $tokenData['openID'] ?? $tokenData['unionID'] ?? null;
    }

    // POST /api/huawei/connect  { code }  - Connected Apps linking
    public function connect(Request $request, HuaweiSyncService $huawei, TrainingSyncService $sync): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        // Huawei auth codes are base64 (contain + / =). Mobile app builds up to 1.4.44
        // pulled the code out of the fitmeet:// redirect URL without decoding it, so it
        // arrived still percent-encoded (%2B, %2F) and the token exchange 422'd every
        // time — web worked because URLSearchParams decodes. A real code never contains
        // '%', so decoding here is safe and fixes already-installed app versions.
        $code = (string) $request->code;
        if (str_contains($code, '%')) {
            $code = rawurldecode($code);
        }

        $data = $this->exchangeCode($code);
        if (!$data || empty($data['access_token'])) {
            return response()->json(['message' => 'Huawei auth failed.'], 422);
        }

        $athleteId = $this->extractOpenId($data);
        if (!$athleteId) {
            return response()->json(['message' => 'Huawei auth failed.'], 422);
        }

        $user = $request->user();
        $nextPriority = ProviderConnection::where('user_id', $user->id)->max('priority');

        $connection = ProviderConnection::updateOrCreate(
            ['user_id' => $user->id, 'provider' => 'huawei'],
            [
                'external_athlete_id' => $athleteId,
                'access_token'        => $data['access_token'],
                'refresh_token'       => $data['refresh_token'] ?? null,
                'token_expires_at'    => isset($data['expires_in'])
                    ? now()->addSeconds((int) $data['expires_in'])
                    : now()->addHour(),
                'scope'               => $data['scope'] ?? null,
                'connected_at'        => now(),
                'priority'            => $nextPriority === null ? 0 : $nextPriority + 1,
                'status'              => ProviderConnection::ACTIVE,
                'status_changed_at'   => now(),
            ],
        );

        $source = $request->input('source') === 'web' ? 'web' : 'app';
        ProviderAuthorizationEvent::record($user->id, 'huawei', ProviderAuthorizationEvent::GRANTED, $connection->scope, $source);

        // A required data permission unchecked on the consent screen: keep the account
        // linked but don't sync, and tell the app which permissions are missing so it
        // can explain and offer to re-authorize (App Release Checklist 3.4).
        $missing = $huawei->missingScopes($connection->scope);
        if ($missing) {
            $connection->markStatus(ProviderConnection::INSUFFICIENT_SCOPE, ProviderAuthorizationEvent::INSUFFICIENT_SCOPE, $source);

            return response()->json([
                'connected'      => true,
                'status'         => ProviderConnection::INSUFFICIENT_SCOPE,
                'missing_scopes' => $missing,
                'synced'         => 0,
            ]);
        }

        $synced = $huawei->backfillHuawei($connection, $sync);
        $status = $connection->fresh()->status;
        if ($status !== ProviderConnection::ACTIVE) {
            return response()->json(['connected' => true, 'status' => $status, 'synced' => 0]);
        }

        // Huawei's cloud activity data can lag briefly right after a fresh OAuth grant
        // (device -> Huawei cloud sync isn't instant) -- if nothing came back on the
        // very first pull, retry once a couple minutes later instead of leaving the
        // user to notice and hit "Resync" manually.
        if ($synced === 0) {
            RetryHuaweiBackfill::dispatch($connection->id)->delay(now()->addMinutes(2));
        }

        return response()->json(['connected' => true, 'status' => ProviderConnection::ACTIVE, 'synced' => $synced]);
    }

    // DELETE /api/huawei/connect   { keep_trainings?: bool (default true) }
    // Revoking in FitMeet (checklist 3.2): Huawei's token is revoked, no further data is
    // read, and the user decides whether already-imported trainings stay or are deleted.
    public function disconnect(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $user = $request->user();
        $connection = ProviderConnection::where('user_id', $user->id)
            ->where('provider', 'huawei')
            ->first();

        $deleted = 0;
        if ($connection) {
            try {
                Http::asForm()->post('https://oauth-login.cloud.huawei.com/oauth2/v3/revoke', [
                    'token' => $connection->access_token,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Huawei token revoke failed', ['exception' => $e->getMessage()]);
            }

            ProviderAuthorizationEvent::record($user->id, 'huawei', ProviderAuthorizationEvent::REVOKED_IN_APP, $connection->scope,
                $request->input('source') === 'web' ? 'web' : 'app');
            $connection->delete();
        }

        if (!$request->boolean('keep_trainings', true)) {
            $deleted = Training::where('user_id', $user->id)->where('provider', 'huawei')->delete();
            $sync->recomputeAllGroups($user->id);
        }

        return response()->json(['disconnected' => true, 'trainings_deleted' => $deleted]);
    }

    // POST /api/huawei/verify — live check on app start (checklist 3.3 / 3.5): reports
    // whether FitMeet can still read HUAWEI Health data, so a revocation or a switched-off
    // HUAWEI Health Kit is shown to the user immediately.
    public function verify(Request $request, HuaweiSyncService $huawei): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'huawei')
            ->first();

        if (!$connection) {
            return response()->json(['status' => 'none']);
        }

        return response()->json(['status' => $huawei->verify($connection)]);
    }

    // POST /api/huawei/resync
    public function resync(Request $request, HuaweiSyncService $huawei, TrainingSyncService $sync): JsonResponse
    {
        $connection = ProviderConnection::where('user_id', $request->user()->id)
            ->where('provider', 'huawei')
            ->first();

        if (!$connection) {
            return response()->json(['message' => 'Huawei not connected.'], 422);
        }

        $status = $huawei->verify($connection);
        if ($status !== ProviderConnection::ACTIVE) {
            return response()->json(['message' => 'HUAWEI Health access is not available.', 'status' => $status], 422);
        }

        $synced = $huawei->backfillHuawei($connection, $sync);

        return response()->json(['connected' => true, 'status' => $connection->fresh()->status, 'synced' => $synced]);
    }
}
