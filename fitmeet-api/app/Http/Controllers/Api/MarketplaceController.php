<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplaceListingResource;
use App\Models\MarketplaceListing;
use App\Models\MarketplaceListingImage;
use App\Services\ContentFilterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class MarketplaceController extends Controller
{
    // GET /api/market/public-latest (no auth)
    public function publicLatest(Request $request): JsonResponse
    {
        $limit = min((int) ($request->query('limit', 10)), 20);

        $listings = MarketplaceListing::with(['seller', 'images'])
            ->where('status', 'active')
            ->latest()
            ->limit($limit)
            ->get();

        return response()->json(['data' => MarketplaceListingResource::collection($listings)]);
    }

    // GET /api/market/public/{listing} (no auth)
    public function publicShow(MarketplaceListing $listing): JsonResponse
    {
        if (! in_array($listing->status, ['active', 'sold'], true)) {
            return response()->json(['message' => 'Listing not found.'], 404);
        }

        $listing->load(['seller', 'images']);

        return response()->json(['data' => new MarketplaceListingResource($listing)]);
    }

    // GET /api/market/og?id=X — OG meta HTML for social crawlers
    public function ogPage(Request $request): \Illuminate\Http\Response
    {
        $siteUrl  = 'https://fitmeet.fit';
        $id       = (int) $request->query('id', 0);
        $shareUrl = $siteUrl . '/market/share/?id=' . $id;

        $listing = $id ? MarketplaceListing::with(['images'])->find($id) : null;

        if (! $listing || ! in_array($listing->status, ['active', 'sold'], true)) {
            return response(
                '<html><head><meta http-equiv="refresh" content="0;url=' . e($shareUrl) . '"></head><body></body></html>',
                200, ['Content-Type' => 'text/html']
            );
        }

        $price      = (float) ($listing->price ?? 0);
        $type       = $listing->type ?? 'sell';
        $currency   = $listing->currency ?? 'EUR';
        $priceLabel = $price > 0
            ? (($type === 'buy' ? 'up to ' : '') . number_format($price, 0) . ' ' . $currency)
            : ($type === 'buy' ? 'Wanted' : 'For sale');

        $conditionMap = ['new' => 'New', 'used' => 'Used', 'like_new' => 'Like new'];
        $category  = $listing->category?->label() ?? $listing->category?->value ?? 'Market';
        $condition = $conditionMap[$listing->condition ?? ''] ?? null;
        $location  = implode(', ', array_filter([$listing->location_city, $listing->location_country]));

        $title = ($listing->title ?? 'FitMeet Market') . ' — ' . $priceLabel . ' | FitMeet Market';
        $parts = array_filter([$priceLabel, $category, $condition, $location, $listing->description]);
        $description = mb_substr(implode(' | ', $parts), 0, 300);

        $image = $siteUrl . '/logo_full.png';
        if ($listing->images->isNotEmpty()) {
            $image = url('/storage/' . $listing->images->first()->path);
        }

        $h    = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $html = <<<HTML
<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>{$h($title)}</title>
<meta name="description" content="{$h($description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="FitMeet">
<meta property="og:title" content="{$h($title)}">
<meta property="og:description" content="{$h($description)}">
<meta property="og:url" content="{$h($shareUrl)}">
<meta property="og:image" content="{$h($image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{$h($title)}">
<meta name="twitter:description" content="{$h($description)}">
<meta name="twitter:image" content="{$h($image)}">
<meta http-equiv="refresh" content="0;url={$h($shareUrl)}">
</head><body>
<h1>{$h($listing->title)}</h1>
<p>{$h($description)}</p>
<a href="{$h($shareUrl)}">Open in FitMeet</a>
</body></html>
HTML;

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    // GET /api/market
    public function index(Request $request): JsonResponse
    {
        $query = MarketplaceListing::with(['seller', 'images'])
            ->whereNotIn('user_id', $request->user()->blockedUserIds())
            ->latest();

        if ($request->filled('my') && $request->my) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->filled('status') && in_array($request->status, ['active', 'sold'])) {
            $query->where('status', $request->status);
        } else if (! $request->filled('my') || ! $request->my) {
            $query->whereIn('status', ['active', 'sold']);
        }

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

    // GET /api/market/saved
    public function saved(Request $request): JsonResponse
    {
        $listings = MarketplaceListing::with(['seller', 'images', 'savedByUsers'])
            ->whereHas('savedByUsers', fn ($q) => $q->where('user_id', $request->user()->id))
            ->latest()
            ->get();

        return response()->json(['data' => MarketplaceListingResource::collection($listings)]);
    }

    // GET /api/market/{listing}
    public function show(Request $request, MarketplaceListing $listing): JsonResponse
    {
        $listing->load(['seller', 'images', 'savedByUsers']);

        if ($listing->user_id !== $request->user()->id) {
            $listing->increment('views_count');
        }

        return response()->json(['data' => new MarketplaceListingResource($listing)]);
    }

    // POST /api/market/{listing}/save
    public function toggleSave(Request $request, MarketplaceListing $listing): JsonResponse
    {
        $userId = $request->user()->id;
        $saved  = $listing->savedByUsers()->where('user_id', $userId)->exists();

        if ($saved) {
            $listing->savedByUsers()->detach($userId);
        } else {
            $listing->savedByUsers()->attach($userId);
        }

        return response()->json(['is_saved' => ! $saved]);
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

        if (ContentFilterService::containsObjectionableContent($data['title'])
            || ContentFilterService::containsObjectionableContent($data['description'] ?? null)) {
            return response()->json(['message' => 'This listing isn\'t allowed. Please revise the title/description.'], 422);
        }

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
            'type'             => ['nullable', Rule::in(['sell', 'buy'])],
            'title'            => 'sometimes|string|max:200',
            'description'      => 'nullable|string|max:2000',
            'price'            => 'nullable|numeric|min:0|max:99999',
            'currency'         => 'nullable|string|size:3',
            'condition'        => ['nullable', Rule::in(['new', 'used', 'like_new'])],
            'category'         => ['sometimes', Rule::in(\App\Enums\Category::values())],
            'images'           => 'nullable|array|max:5',
            'images.*'         => 'image|max:5120',
            'keep_image_ids'   => 'nullable|array',
            'keep_image_ids.*' => 'integer',
        ]);

        if (ContentFilterService::containsObjectionableContent($data['title'] ?? null)
            || ContentFilterService::containsObjectionableContent($data['description'] ?? null)) {
            return response()->json(['message' => 'This listing isn\'t allowed. Please revise the title/description.'], 422);
        }

        unset($data['images'], $data['keep_image_ids']);
        $listing->update($data);

        $keepIds = $request->input('keep_image_ids');
        if ($keepIds !== null || $request->hasFile('images')) {
            $keepIds = $keepIds ?? [];
            foreach ($listing->images as $img) {
                if (! in_array($img->id, $keepIds, false)) {
                    Storage::disk('public')->delete($img->path);
                    $img->delete();
                }
            }

            if ($request->hasFile('images')) {
                $nextOrder = count($keepIds);
                foreach ($request->file('images') as $file) {
                    $path = $file->store('marketplace', 'public');
                    MarketplaceListingImage::create([
                        'listing_id' => $listing->id,
                        'path'       => $path,
                        'sort_order' => $nextOrder++,
                    ]);
                }
            }
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

        $newStatus = $listing->status === 'sold' ? 'active' : 'sold';
        $listing->update(['status' => $newStatus]);

        $listing->load(['seller', 'images', 'savedByUsers']);

        return response()->json([
            'message' => $newStatus === 'sold' ? 'Marked as sold.' : 'Marked as active.',
            'data'    => new MarketplaceListingResource($listing),
        ]);
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
