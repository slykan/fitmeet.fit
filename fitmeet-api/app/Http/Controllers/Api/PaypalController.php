<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BeerDonation;
use App\Services\BeerPurchaseNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PaypalController extends Controller
{
    private function baseUrl(): string
    {
        return env('PAYPAL_MODE', 'live') === 'sandbox'
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
    }

    private function accessToken(): string
    {
        $response = Http::asForm()
            ->withBasicAuth(env('PAYPAL_CLIENT_ID'), env('PAYPAL_SECRET'))
            ->post($this->baseUrl() . '/v1/oauth2/token', [
                'grant_type' => 'client_credentials',
            ]);

        return $response->json('access_token');
    }

    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|in:beer_small,beer_medium,beer_large',
        ]);

        $amounts = [
            'beer_small'  => '3.00',
            'beer_medium' => '6.00',
            'beer_large'  => '12.00',
        ];

        $token = $this->accessToken();

        $response = Http::withToken($token)
            ->post($this->baseUrl() . '/v2/checkout/orders', [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'amount' => [
                        'currency_code' => 'EUR',
                        'value'         => $amounts[$validated['product_id']],
                    ],
                    'description' => 'FitMeet — Buy me a beer',
                ]],
            ]);

        if (!$response->successful()) {
            return response()->json(['error' => 'Could not create PayPal order.'], 502);
        }

        return response()->json([
            'order_id' => $response->json('id'),
        ]);
    }

    public function captureOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id'   => 'required|string',
            'product_id' => 'required|in:beer_small,beer_medium,beer_large',
        ]);

        $token = $this->accessToken();

        $response = Http::withToken($token)
            ->withBody('{}', 'application/json')
            ->post($this->baseUrl() . "/v2/checkout/orders/{$validated['order_id']}/capture");

        if (!$response->successful() || $response->json('status') !== 'COMPLETED') {
            \Log::error('PayPal capture failed', [
                'status'  => $response->status(),
                'body'    => $response->json(),
                'order'   => $validated['order_id'],
            ]);
            return response()->json(['error' => 'Payment not completed.'], 402);
        }

        BeerDonation::create([
            'user_id'    => $request->user()->id,
            'product_id' => $validated['product_id'],
        ]);

        app(BeerPurchaseNotifier::class)->notify($request->user(), $validated['product_id']);

        return response()->json(['status' => 'ok']);
    }
}
