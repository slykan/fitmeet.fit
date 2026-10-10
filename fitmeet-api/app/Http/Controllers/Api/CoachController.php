<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Training;
use App\Models\TrainingCoachNote;
use App\Services\TrainingCoach;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * AI coach for a training — owner only (Strava API terms). Each analysis and each
 * question is one AI call against a monthly allowance; results are stored, so
 * opening the same analysis or answer again costs nothing.
 */
class CoachController extends Controller
{
    // GET /api/trainings/{training}/coach
    public function show(Request $request, Training $training): JsonResponse
    {
        if ($training->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json($this->payload($request, $training));
    }

    // POST /api/trainings/{training}/coach { language }
    public function analyze(Request $request, Training $training, TrainingCoach $coach): JsonResponse
    {
        $data = $request->validate(['language' => 'nullable|string|max:12']);
        if ($training->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if (TrainingCoachNote::where('training_id', $training->id)->exists()) {
            return response()->json($this->payload($request, $training));
        }
        if (!TrainingCoach::available()) {
            return response()->json(['message' => 'The coach is not available right now.'], 503);
        }
        if ($this->left($request, 'analyze') <= 0) {
            return response()->json(['message' => 'You have used all coach analyses for this month.', 'code' => 'quota'], 429);
        }

        $language = $this->language($data['language'] ?? null);
        try {
            $result = $coach->analyze($training, $language);
        } catch (\Throwable $e) {
            Log::warning('Coach analysis failed', ['training_id' => $training->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'The coach could not analyse this training. Please try again.'], 502);
        }

        TrainingCoachNote::create([
            'training_id' => $training->id,
            'user_id'     => $training->user_id,
            'language'    => $language,
            'headline'    => $result['headline'],
            'summary'     => $result['summary'],
            'tip'         => $result['tip'],
            'questions'   => $result['questions'],
            'answers'     => [],
            'model'       => (string) config('services.anthropic.coach_model'),
        ]);
        $this->log($request, $training, 'analyze', $result['usage']);

        return response()->json($this->payload($request, $training));
    }

    // POST /api/trainings/{training}/coach/ask { question, language }
    public function ask(Request $request, Training $training, TrainingCoach $coach): JsonResponse
    {
        $data = $request->validate([
            'question' => 'required|string|max:300',
            'language' => 'nullable|string|max:12',
        ]);
        if ($training->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $note = TrainingCoachNote::where('training_id', $training->id)->first();
        if (!$note) {
            return response()->json(['message' => 'Analyse the training first.'], 422);
        }

        $question = trim($data['question']);
        // Same question again (e.g. a suggested one tapped twice): stored answer, no new call.
        foreach ($note->answers ?? [] as $qa) {
            if (mb_strtolower($qa['question']) === mb_strtolower($question)) {
                return response()->json($this->payload($request, $training));
            }
        }
        if (!TrainingCoach::available()) {
            return response()->json(['message' => 'The coach is not available right now.'], 503);
        }
        if ($this->left($request, 'ask') <= 0) {
            return response()->json(['message' => 'You have used all coach questions for this month.', 'code' => 'quota'], 429);
        }

        try {
            $result = $coach->ask($training, $this->language($data['language'] ?? $note->language), $note->only(['headline', 'summary', 'tip', 'answers']), $question);
        } catch (\Throwable $e) {
            Log::warning('Coach question failed', ['training_id' => $training->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'The coach could not answer. Please try again.'], 502);
        }

        $note->update(['answers' => array_merge($note->answers ?? [], [[
            'question' => $question,
            'answer'   => $result['answer'],
            'at'       => now()->toIso8601String(),
        ]])]);
        $this->log($request, $training, 'ask', $result['usage']);

        return response()->json($this->payload($request, $training));
    }

    private function payload(Request $request, Training $training): array
    {
        $note = TrainingCoachNote::where('training_id', $training->id)->first();

        return [
            'available' => TrainingCoach::available(),
            'note'      => $note ? [
                'headline'  => $note->headline,
                'summary'   => $note->summary,
                'tip'       => $note->tip,
                'questions' => $note->questions ?? [],
                'answers'   => $note->answers ?? [],
                'language'  => $note->language,
            ] : null,
            'quota' => [
                'analyses_left'  => $this->left($request, 'analyze'),
                'questions_left' => $this->left($request, 'ask'),
            ],
        ];
    }

    private function left(Request $request, string $kind): int
    {
        $limit = (int) config($kind === 'analyze' ? 'services.anthropic.coach_monthly_analyses' : 'services.anthropic.coach_monthly_questions');
        $used = DB::table('coach_requests')
            ->where('user_id', $request->user()->id)
            ->where('kind', $kind)
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();

        return max(0, $limit - $used);
    }

    private function log(Request $request, Training $training, string $kind, array $usage): void
    {
        DB::table('coach_requests')->insert([
            'user_id'       => $request->user()->id,
            'training_id'   => $training->id,
            'kind'          => $kind,
            'input_tokens'  => $usage['input_tokens'] ?? 0,
            'output_tokens' => $usage['output_tokens'] ?? 0,
            'created_at'    => now(),
        ]);
    }

    /** Phone language from the app (e.g. "hr-HR" → "hr"); English when unknown. */
    private function language(?string $tag): string
    {
        $tag = strtolower(trim((string) $tag));

        return preg_match('/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/', $tag) ? explode('-', $tag)[0] : 'en';
    }
}
