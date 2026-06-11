<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'                  => ['required', 'string', 'max:100'],
            'email'                 => ['required', 'email', 'unique:users,email'],
            'password'              => ['required', 'string', 'min:8'],
            'cf_turnstile_response' => ['required', 'string'],
        ]);

        $verify = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'secret'   => $this->turnstileSecret(),
            'response' => $request->cf_turnstile_response,
            'remoteip' => $request->ip(),
        ]);

        if (! $verify->json('success')) {
            $codes = implode(', ', $verify->json('error-codes') ?? []);
            return response()->json(['message' => "Security check failed: {$codes}"], 422);
        }

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => $request->password,
        ]);

        $token = $user->createToken('fitmeet')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ], 201);
    }

    // POST /api/auth/register-mobile
    public function registerMobile(Request $request): JsonResponse
    {
        $request->validate([
            'name'                  => ['required', 'string', 'max:100'],
            'email'                 => ['required', 'email', 'unique:users,email'],
            'password'              => ['required', 'string', 'min:8'],
            'cf_turnstile_response' => ['required', 'string'],
        ]);

        $verify = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'secret'   => $this->turnstileSecret(),
            'response' => $request->cf_turnstile_response,
        ]);

        if (! $verify->json('success')) {
            return response()->json(['message' => 'Security check failed.'], 422);
        }

        $user  = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => $request->password,
        ]);
        $token = $user->createToken('fitmeet-mobile')->plainTextToken;

        return response()->json(['token' => $token, 'data' => new UserResource($user)], 201);
    }

    // POST /api/auth/login-mobile
    public function loginMobile(Request $request): JsonResponse
    {
        $request->validate([
            'email'                 => ['required', 'email'],
            'password'              => ['required'],
            'cf_turnstile_response' => ['required', 'string'],
        ]);

        $verify = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'secret'   => $this->turnstileSecret(),
            'response' => $request->cf_turnstile_response,
        ]);

        if (! $verify->json('success')) {
            return response()->json(['message' => 'Security check failed.'], 422);
        }

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid email or password.'], 401);
        }

        $user  = Auth::user();
        $token = $user->createToken('fitmeet-mobile')->plainTextToken;

        return response()->json(['token' => $token, 'data' => new UserResource($user)]);
    }

    // POST /api/auth/google-mobile
    public function googleMobile(Request $request): JsonResponse
    {
        $request->validate(['access_token' => ['required', 'string']]);

        $res = Http::get('https://www.googleapis.com/oauth2/v3/userinfo', [
            'access_token' => $request->access_token,
        ]);

        if (! $res->ok() || empty($res->json('email'))) {
            return response()->json(['message' => 'Invalid Google token.'], 401);
        }

        $g    = $res->json();
        $user = User::where('google_id', $g['sub'] ?? '')->orWhere('email', $g['email'])->first();

        if ($user) {
            $update = ['google_id' => $g['sub'] ?? $user->google_id];
            // Only set Google avatar if user has no custom avatar yet
            if (empty($user->avatar) && ! empty($g['picture'])) {
                $update['avatar'] = $g['picture'];
            }
            $user->update($update);
        } else {
            $user = User::create([
                'name'      => $g['name'] ?? $g['email'],
                'email'     => $g['email'],
                'google_id' => $g['sub'] ?? null,
                'avatar'    => $g['picture'] ?? null,
            ]);
        }

        $token = $user->createToken('fitmeet-mobile')->plainTextToken;

        return response()->json(['token' => $token, 'data' => new UserResource($user)]);
    }

    // POST /api/auth/apple-mobile
    public function appleMobile(Request $request): JsonResponse
    {
        $request->validate(['identity_token' => ['required', 'string']]);

        $claims = $this->verifyAppleToken($request->identity_token);

        if (! $claims || empty($claims['sub'])) {
            return response()->json(['message' => 'Invalid Apple token.'], 401);
        }

        $appleId = $claims['sub'];
        $email   = $claims['email'] ?? null;

        $fullName = $request->input('full_name');
        $firstName = $fullName['firstName'] ?? null;
        $lastName  = $fullName['lastName'] ?? null;
        $name = trim(($firstName ?? '') . ' ' . ($lastName ?? '')) ?: null;

        $user = User::where('apple_id', $appleId)
            ->orWhere(fn ($q) => $q->whereNotNull('email')->where('email', $email))
            ->first();

        if ($user) {
            $update = ['apple_id' => $appleId];
            $user->update($update);
        } else {
            $user = User::create([
                'name'     => $name ?? ($email ? explode('@', $email)[0] : 'FitMeet User'),
                'email'    => $email,
                'apple_id' => $appleId,
            ]);
        }

        $token = $user->createToken('fitmeet-mobile')->plainTextToken;

        return response()->json(['token' => $token, 'data' => new UserResource($user)]);
    }

    private function verifyAppleToken(string $identityToken): ?array
    {
        $parts = explode('.', $identityToken);
        if (count($parts) !== 3) return null;

        $header = json_decode($this->base64UrlDecode($parts[0]), true);
        if (! $header || empty($header['kid'])) return null;

        $keysRes = Http::get('https://appleid.apple.com/auth/keys');
        if (! $keysRes->ok()) return null;

        $matchingKey = null;
        foreach ($keysRes->json('keys') ?? [] as $key) {
            if ($key['kid'] === $header['kid']) {
                $matchingKey = $key;
                break;
            }
        }
        if (! $matchingKey) return null;

        $pem  = $this->jwkToPem($matchingKey);
        $data = $parts[0] . '.' . $parts[1];
        $sig  = $this->base64UrlDecode($parts[2]);

        if (openssl_verify($data, $sig, $pem, 'SHA256') !== 1) return null;

        $payload = json_decode($this->base64UrlDecode($parts[1]), true);
        if (! $payload) return null;
        if (($payload['iss'] ?? '') !== 'https://appleid.apple.com') return null;
        if (($payload['aud'] ?? '') !== 'app.fitmeet.fit') return null;
        if (($payload['exp'] ?? 0) < time()) return null;

        return $payload;
    }

    private function jwkToPem(array $jwk): string
    {
        $n = $this->base64UrlDecode($jwk['n']);
        $e = $this->base64UrlDecode($jwk['e']);

        if (ord($n[0]) >= 128) $n = "\x00" . $n;

        $encLen = fn(int $len): string => $len < 128
            ? chr($len)
            : (fn($t) => chr(0x80 | strlen($t)) . $t)(ltrim(pack('N', $len), "\x00"));

        $seq  = "\x02" . $encLen(strlen($n)) . $n . "\x02" . $encLen(strlen($e)) . $e;
        $seq  = "\x30" . $encLen(strlen($seq)) . $seq;
        $bits = "\x00" . $seq;
        $oid  = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
        $pub  = $oid . "\x03" . $encLen(strlen($bits)) . $bits;
        $der  = "\x30" . $encLen(strlen($pub)) . $pub;

        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private function base64UrlDecode(string $data): string
    {
        $rem = strlen($data) % 4;
        if ($rem) $data .= str_repeat('=', 4 - $rem);
        return base64_decode(strtr($data, '-_', '+/'));
    }

    private function turnstileSecret(): string
    {
        $secret = (string) (config('services.turnstile.secret') ?: env('TURNSTILE_SECRET', ''));

        if ($secret !== '') {
            return $secret;
        }

        $envPath = base_path('.env');
        if (! is_readable($envPath)) {
            return '';
        }

        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if (str_starts_with($line, 'TURNSTILE_SECRET=')) {
                return trim(substr($line, strlen('TURNSTILE_SECRET=')), " \t\n\r\0\x0B\"'");
            }
        }

        return '';
    }

    public function loginWithEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid email or password.'], 401);
        }

        $user  = Auth::user();
        $token = $user->createToken('fitmeet')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ]);
    }

    public function redirectToGoogle(): JsonResponse
    {
        $url = Socialite::driver('google')->stateless()->redirect()->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect(env('FRONTEND_URL') . '/login?error=auth_failed');
        }

        // Merge with existing email account if present
        $user = User::where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        if ($user) {
            $update = ['google_id' => $googleUser->getId()];
            if (empty($user->avatar) && $googleUser->getAvatar()) {
                $update['avatar'] = $googleUser->getAvatar();
            }
            $user->update($update);
        } else {
            $user = User::create([
                'name'      => $googleUser->getName(),
                'email'     => $googleUser->getEmail(),
                'google_id' => $googleUser->getId(),
                'avatar'    => $googleUser->getAvatar(),
            ]);
        }

        $token = $user->createToken('fitmeet')->plainTextToken;

        return redirect(env('FRONTEND_URL') . '/login/?token=' . $token);
    }

    public function me(): JsonResponse
    {
        return response()->json([
            'data' => new UserResource(auth()->user()),
        ]);
    }

    public function logout(): JsonResponse
    {
        auth()->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function destroyAccount(): JsonResponse
    {
        $user = auth()->user();

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Account deleted.']);
    }
}
