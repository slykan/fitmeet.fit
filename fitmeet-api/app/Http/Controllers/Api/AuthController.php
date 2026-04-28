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
            $user->update([
                'google_id' => $g['sub'] ?? $user->google_id,
                'avatar'    => $user->avatar ?? $g['picture'] ?? null,
            ]);
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
            $user->update([
                'google_id' => $googleUser->getId(),
                'avatar'    => $googleUser->getAvatar(),
            ]);
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
}
