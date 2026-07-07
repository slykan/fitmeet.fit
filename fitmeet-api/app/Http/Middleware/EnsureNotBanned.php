<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureNotBanned
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->banned_at) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        return $next($request);
    }
}
