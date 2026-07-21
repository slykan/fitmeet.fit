<?php

namespace App\Http\Controllers\Api;

use App\Models\ProviderConnection;
use App\Services\TrainingSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderConnectionController
{
    // GET /api/connections
    public function index(Request $request): JsonResponse
    {
        $connections = ProviderConnection::where('user_id', $request->user()->id)
            ->orderBy('priority')
            ->get()
            ->map(fn (ProviderConnection $c) => [
                'provider'       => $c->provider,
                'priority'       => $c->priority,
                'connected_at'   => $c->connected_at,
                'last_synced_at' => $c->last_synced_at,
            ]);

        return response()->json(['data' => $connections]);
    }

    // POST /api/connections/reorder  { providers: ['garmin', 'strava'] }
    public function reorder(Request $request, TrainingSyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'providers'   => 'required|array|min:1',
            'providers.*' => 'required|string',
        ]);

        foreach ($data['providers'] as $index => $provider) {
            ProviderConnection::where('user_id', $request->user()->id)
                ->where('provider', $provider)
                ->update(['priority' => $index]);
        }

        $sync->recomputeAllGroups($request->user()->id);

        return response()->json(['message' => 'Priority updated.']);
    }
}
