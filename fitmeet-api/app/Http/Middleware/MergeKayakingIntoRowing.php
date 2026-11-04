<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Kayaking was merged into Rowing (2026-11-04). Older apps still offer "kayaking",
 * so it is rewritten to "rowing" in any category / categories input or filter.
 */
class MergeKayakingIntoRowing
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->input('category') === 'kayaking') {
            $request->merge(['category' => 'rowing']);
        }

        $categories = $request->input('categories');
        if (is_array($categories) && in_array('kayaking', $categories, true)) {
            $request->merge(['categories' => array_values(array_unique(
                array_map(fn ($c) => $c === 'kayaking' ? 'rowing' : $c, $categories)
            ))]);
        }

        return $next($request);
    }
}
