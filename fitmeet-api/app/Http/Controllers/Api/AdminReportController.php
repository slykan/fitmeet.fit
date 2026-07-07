<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminReportController extends Controller
{
    // GET /api/admin/reports
    public function index(): JsonResponse
    {
        $reports = Report::with('reporter:id,name')
            ->where('status', 'pending')
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (Report $report) => [
                'id'         => $report->id,
                'reporter'   => $report->reporter?->name,
                'type'       => $report->reportable_type,
                'reason'     => $report->reason,
                'details'    => $report->details,
                'preview'    => $this->preview($report),
                'created_at' => $report->created_at->toIso8601String(),
            ]);

        return response()->json(['data' => $reports]);
    }

    // POST /api/admin/reports/{report}/resolve
    public function resolve(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['remove', 'dismiss'])],
        ]);

        if ($data['action'] === 'dismiss') {
            $report->update(['status' => 'dismissed']);

            return response()->json(['message' => 'Report dismissed.']);
        }

        $offender = $this->offendingUser($report);
        $content  = $report->reportable;

        if ($content) {
            $content->delete();
        }

        if ($offender) {
            $offender->update(['banned_at' => now()]);
            $offender->tokens()->delete();
        }

        $report->update(['status' => 'actioned']);

        return response()->json(['message' => 'Content removed and user ejected.']);
    }

    private function preview(Report $report): ?string
    {
        $content = $report->reportable;

        return match (true) {
            $content === null => '(content already removed)',
            $report->reportable_type === 'user'    => "User: {$content->name}",
            $report->reportable_type === 'comment' => "Comment: \"{$content->body}\"",
            $report->reportable_type === 'listing' => "Listing: {$content->title}",
            $report->reportable_type === 'message' => "Message: \"{$content->body}\"",
            $report->reportable_type === 'event'   => "Event: {$content->title}",
            default => null,
        };
    }

    private function offendingUser(Report $report): ?User
    {
        $content = $report->reportable;
        if (! $content) {
            return null;
        }

        return match ($report->reportable_type) {
            'user'    => $content,
            'comment', 'listing', 'event' => User::find($content->user_id),
            'message' => User::find($content->sender_id),
            default   => null,
        };
    }
}
