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

        if ($request->query('sort') === 'recent') {
            $donations = BeerDonation::with('user:id,name')
                ->latest()
                ->limit($limit)
                ->get()
                ->map(fn ($d) => [
                    'name'             => $d->user->name,
                    'beer_score'       => 1,
                    'beer_top_tier'    => $d->product_id,
                    'last_donation_at' => $d->created_at,
                ])
                ->values();

            return response()->json($donations);
        }

        $weights = ['beer_small' => 1, 'beer_medium' => 2, 'beer_large' => 3];

        $donors = BeerDonation::with('user:id,name')
            ->get()
            ->groupBy('user_id')
            ->map(function ($donations) use ($weights) {
                $score   = $donations->sum(fn($d) => $weights[$d->product_id] ?? 1);
                $topTier = $donations->sortByDesc(fn($d) => $weights[$d->product_id] ?? 0)->first();
                return [
                    'name'             => $topTier->user->name,
                    'beer_score'       => $score,
                    'beer_top_tier'    => $topTier->product_id,
                    'last_donation_at' => $donations->max('created_at'),
                ];
            })
            ->sortByDesc('beer_score')
            ->take($limit)
            ->values();

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
