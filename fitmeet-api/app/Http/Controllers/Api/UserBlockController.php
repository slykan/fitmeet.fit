<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Report;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserBlockController extends Controller
{
    // GET /api/blocks
    public function index(Request $request): JsonResponse
    {
        $blocked = User::whereIn('id', $request->user()->blocksInitiated()->pluck('blocked_id'))->get();

        return response()->json(['data' => UserResource::collection($blocked)]);
    }

    // POST /api/blocks/{user}
    public function store(Request $request, User $user): JsonResponse
    {
        $me = $request->user();
        abort_if($user->id === $me->id, 422, 'You cannot block yourself.');

        UserBlock::firstOrCreate([
            'blocker_id' => $me->id,
            'blocked_id' => $user->id,
        ]);

        // Apple guideline 1.2: blocking must also notify the developer of the
        // inappropriate content/behavior so it can be reviewed within 24h.
        Report::create([
            'reporter_id'     => $me->id,
            'reportable_type' => 'user',
            'reportable_id'   => $user->id,
            'reason'          => 'safety',
            'details'         => 'Auto-generated: user was blocked.',
            'status'          => 'pending',
        ]);

        return response()->json(['message' => 'User blocked.']);
    }

    // DELETE /api/blocks/{user}
    public function destroy(Request $request, User $user): JsonResponse
    {
        UserBlock::where('blocker_id', $request->user()->id)
            ->where('blocked_id', $user->id)
            ->delete();

        return response()->json(['message' => 'User unblocked.']);
    }
}
