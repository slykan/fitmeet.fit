<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    // Whitelisted client-facing keys — never resolve a class from raw client input.
    private const REPORTABLE_TYPES = ['user', 'event', 'comment', 'listing', 'message'];

    private const REASONS = ['spam', 'harassment', 'inappropriate', 'safety', 'other'];

    // POST /api/reports
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reportable_type' => ['required', Rule::in(self::REPORTABLE_TYPES)],
            'reportable_id'   => ['required', 'integer'],
            'reason'          => ['required', Rule::in(self::REASONS)],
            'details'         => ['nullable', 'string', 'max:1000'],
        ]);

        Report::create([
            'reporter_id'     => $request->user()->id,
            'reportable_type' => $data['reportable_type'],
            'reportable_id'   => $data['reportable_id'],
            'reason'          => $data['reason'],
            'details'         => $data['details'] ?? null,
            'status'          => 'pending',
        ]);

        return response()->json(['message' => 'Report submitted. Our team reviews reports within 24 hours.'], 201);
    }
}
