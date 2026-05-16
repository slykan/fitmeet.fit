<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BeerDonation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class BeerDonationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = min((int) $request->query('limit', 10), 200);

        $donors = BeerDonation::with('user:id,name')
            ->latest()
            ->take($limit)
            ->get()
            ->map(fn($d) => [
                'name'       => $d->user->name,
                'product_id' => $d->product_id,
            ]);

        return response()->json($donors);
    }

    public function store(Request $request): Response
    {
        $validated = $request->validate([
            'product_id' => 'required|in:beer_small,beer_medium,beer_large',
        ]);

        BeerDonation::create([
            'user_id'    => $request->user()->id,
            'product_id' => $validated['product_id'],
        ]);

        return response()->noContent();
    }
}
