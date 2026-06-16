<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplaceListingResource;
use App\Models\MarketplaceListing;
use App\Models\MarketplaceListingImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class MarketplaceController extends Controller
{
    // GET /api/market
    public function index(Request $request): JsonResponse
    {
        $query = MarketplaceListing::with(['seller', 'images'])
            ->where('status', 'active')
            ->latest();

        if ($request->filled('type') && in_array($request->type, ['sell', 'buy'])) {
            $query->where('type', $request->type);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('condition')) {
            $query->where('condition', $request->condition);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('description', 'like', $search);
            });
        }

        $listings = $query->paginate(20);

        return response()->json([
            'data' => MarketplaceListingResource::collection($listings->items()),
            'meta' => [
                'current_page' => $listings->currentPage(),
                'last_page'    => $listings->lastPage(),
                'total'        => $listings->total(),
            ],
        ]);
    }

    // GET /api/market/my
    public function my(Request $request): JsonResponse
    {
        $listings = MarketplaceListing::with(['seller', 'images'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => MarketplaceListingResource::collection($listings)]);
    }

    // GET /api/market/{listing}
    public function show(Request $request, MarketplaceListing $listing): JsonResponse
    {
        $listing->load(['seller', 'images']);

        return response()->json(['data' => new MarketplaceListingResource($listing)]);
    }

    // POST /api/market
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'        => ['nullable', Rule::in(['sell', 'buy'])],
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string|max:2000',
            'price'       => 'nullable|numeric|min:0|max:99999',
            'currency'    => 'nullable|string|size:3',
            'condition'   => ['nullable', Rule::in(['new', 'used', 'like_new'])],
            'category'    => ['required', Rule::in(\App\Enums\Category::values())],
            'images'      => 'nullable|array|max:5',
            'images.*'    => 'image|max:5120',
        ]);

        $user = $request->user();

        $listing = MarketplaceListing::create([
            'user_id'          => $user->id,
            'type'             => $data['type'] ?? 'sell',
            'title'            => $data['title'],
            'description'      => $data['description'] ?? null,
            'price'            => $data['price'] ?? 0,
            'currency'         => $data['currency'] ?? 'EUR',
            'condition'        => $data['condition'] ?? null,
            'category'         => $data['category'],
            'location_city'    => $user->home_city ?? null,
            'location_country' => $user->home_country ?? null,
            'lat'              => $user->home_lat ?? null,
            'lng'              => $user->home_lng ?? null,
        ]);

        $this->storeImages($request, $listing);

        $listing->load(['seller', 'images']);

        return response()->json(['data' => new MarketplaceListingResource($listing)], 201);
    }

    // PUT /api/market/{listing}
    public function update(Request $request, MarketplaceListing $listing): JsonResponse
    {
        if ($listing->user_id !== $request->user()->id && ! $request->user()->is_admin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:200',
            'description' => 'nullable|string|max:2000',
            'price'       => 'nullable|numeric|min:0|max:99999',
            'condition'   => ['nullable', Rule::in(['new', 'used', 'like_new'])],
            'category'    => ['sometimes', Rule::in(\App\Enums\Category::values())],
            'images'      => 'nullable|array|max:5',
            'images.*'    => 'image|max:5120',
        ]);

        $listing->update(array_filter($data, fn ($v, $k) => !in_array($k, ['images']), ARRAY_FILTER_USE_BOTH));

        if ($request->hasFile('images')) {
            foreach ($listing->images as $img) {
                Storage::disk('public')->delete($img->path);
                $img->delete();
            }
            $this->storeImages($request, $listing);
        }

        $listing->load(['seller', 'images']);

        return response()->json(['data' => new MarketplaceListingResource($listing)]);
    }

    // POST /api/market/{listing}/sold
    public function markSold(Request $request, MarketplaceListing $listing): JsonResponse
    {
        if ($listing->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $listing->update(['status' => 'sold']);

        return response()->json(['message' => 'Marked as sold.']);
    }

    // DELETE /api/market/{listing}
    public function destroy(Request $request, MarketplaceListing $listing): JsonResponse
    {
        if ($listing->user_id !== $request->user()->id && ! $request->user()->is_admin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        foreach ($listing->images as $img) {
            Storage::disk('public')->delete($img->path);
        }

        $listing->delete();

        return response()->json(['message' => 'Listing deleted.']);
    }

    private function storeImages(Request $request, MarketplaceListing $listing): void
    {
        if (! $request->hasFile('images')) return;

        foreach ($request->file('images') as $i => $file) {
            $path = $file->store('marketplace', 'public');
            MarketplaceListingImage::create([
                'listing_id' => $listing->id,
                'path'       => $path,
                'sort_order' => $i,
            ]);
        }
    }
}
