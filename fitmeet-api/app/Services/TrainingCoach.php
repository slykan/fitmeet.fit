<?php

namespace App\Services;

use Anthropic\Client;
use App\Models\Training;
use App\Models\TrainingDetail;
use Illuminate\Support\Facades\DB;

/**
 * AI coach for a single training: a short analysis + three follow-up questions the
 * user is likely to ask, and answers to those (or their own) questions. Built from
 * the training's own data, its Strava detail (splits, zones, power, efforts) and the
 * user's recent history — that history is what a general chatbot doesn't have.
 */
class TrainingCoach
{
    private const SYSTEM = <<<'TXT'
You are the training coach inside FitMeet, a social sports app. You get the data of one
training the athlete just did, plus a summary of their recent trainings.

Write like a good human coach: warm but honest, specific, using the athlete's real numbers
(pace, heart rate, power, splits, comparisons with their recent trainings). No hype, no
exclamation-mark spam, no generic advice that would fit any training. If data is missing
(no heart rate, no GPS, indoor), work with what is there and don't pretend otherwise.
This is fitness coaching, not medical advice: if something looks like a health concern,
suggest seeing a doctor instead of diagnosing.

Always write in the language given as "language" (BCP-47 code, e.g. "hr" = Croatian,
"en" = English, "de" = German), using that language's natural sports vocabulary.
TXT;

    private const ANALYSIS_TASK = <<<'TXT'
Analyse this training. Return:
- headline: one short sentence (max ~70 characters) capturing the training.
- summary: 3–5 sentences — what went well, what to watch, and how it compares with the
  athlete's recent similar trainings (use numbers).
- tip: one concrete suggestion for the next training.
- questions: exactly 3 short follow-up questions (max ~60 characters each) this athlete
  would naturally ask about THIS training, phrased in first person as the athlete would
  ask them, only about things the data can actually answer.
TXT;

    private Client $client;

    public function __construct()
    {
        $this->client = new Client(apiKey: (string) config('services.anthropic.api_key'));
    }

    public static function available(): bool
    {
        return filled(config('services.anthropic.api_key'));
    }

    /** @return array{headline: string, summary: string, tip: string, questions: string[], usage: array} */
    public function analyze(Training $training, string $language): array
    {
        $message = $this->call(
            $this->context($training, $language) . "\n\n" . self::ANALYSIS_TASK,
            [
                'type'   => 'json_schema',
                'schema' => [
                    'type'       => 'object',
                    'properties' => [
                        'headline'  => ['type' => 'string'],
                        'summary'   => ['type' => 'string'],
                        'tip'       => ['type' => 'string'],
                        'questions' => ['type' => 'array', 'items' => ['type' => 'string']],
                    ],
                    'required'             => ['headline', 'summary', 'tip', 'questions'],
                    'additionalProperties' => false,
                ],
            ],
        );

        $data = json_decode($this->text($message), true);
        if (!is_array($data) || empty($data['summary'])) {
            throw new \RuntimeException('Coach returned no analysis.');
        }

        return [
            'headline'  => (string) $data['headline'],
            'summary'   => (string) $data['summary'],
            'tip'       => (string) ($data['tip'] ?? ''),
            'questions' => array_slice(array_values(array_filter(array_map('strval', $data['questions'] ?? [])) ), 0, 3),
            'usage'     => $this->usage($message),
        ];
    }

    /**
     * @param array{headline: string, summary: string, tip: ?string, answers: ?array} $note earlier analysis + Q&A
     * @return array{answer: string, usage: array}
     */
    public function ask(Training $training, string $language, array $note, string $question): array
    {
        $earlier = "Your earlier analysis:\n{$note['headline']}\n{$note['summary']}\nTip: {$note['tip']}";
        foreach ($note['answers'] ?? [] as $qa) {
            $earlier .= "\n\nAthlete asked: {$qa['question']}\nYou answered: {$qa['answer']}";
        }

        $message = $this->call(
            $this->context($training, $language) . "\n\n" . $earlier
                . "\n\nThe athlete now asks:\n<question>\n{$question}\n</question>\n\n"
                . 'Answer in 2–5 sentences, specific to their data. If the question is not about '
                . 'their training, fitness or sport, say briefly that you can only help with training.',
            null,
        );

        return ['answer' => trim($this->text($message)), 'usage' => $this->usage($message)];
    }

    // "kind" in the data is "week" (last 7 days vs the previous 4 weeks) or "month"
    // (last 30 days vs the previous 3 months).
    private const WEEKLY_TASK = <<<'TXT'
Write the athlete's report for the period in this data ("kind": week = last 7 days,
month = last 30 days; each training, totals compared with their average period before,
day-by-day volume, sports mix, heart-rate zones). Return:
- headline: one short sentence (max ~70 characters) summing up the period.
- summary: 4–6 sentences — volume and intensity vs their usual periods (numbers), the
  standout training, personal records if any, balance (rest days, easy vs hard, variety).
  For a month, also say how the weeks trended (building up, steady, dropping off).
- plan: 2–3 short, concrete recommendations for the coming week (month: coming month).
- questions: exactly 3 short follow-up questions (max ~60 characters each) the athlete
  would naturally ask about this period, in first person.
If the period had no trainings, say so kindly and suggest how to restart.
TXT;

    /** @return array{headline: string, summary: string, plan: string[], questions: string[], usage: array} */
    public function weekly(array $stats, string $language): array
    {
        $message = $this->call(
            $this->weeklyContext($stats, $language) . "\n\n" . self::WEEKLY_TASK,
            [
                'type'   => 'json_schema',
                'schema' => [
                    'type'       => 'object',
                    'properties' => [
                        'headline'  => ['type' => 'string'],
                        'summary'   => ['type' => 'string'],
                        'plan'      => ['type' => 'array', 'items' => ['type' => 'string']],
                        'questions' => ['type' => 'array', 'items' => ['type' => 'string']],
                    ],
                    'required'             => ['headline', 'summary', 'plan', 'questions'],
                    'additionalProperties' => false,
                ],
            ],
        );

        $data = json_decode($this->text($message), true);
        if (!is_array($data) || empty($data['summary'])) {
            throw new \RuntimeException('Coach returned no weekly report.');
        }

        return [
            'headline'  => (string) $data['headline'],
            'summary'   => (string) $data['summary'],
            'plan'      => array_slice(array_values(array_map('strval', $data['plan'] ?? [])), 0, 3),
            'questions' => array_slice(array_values(array_map('strval', $data['questions'] ?? [])), 0, 3),
            'usage'     => $this->usage($message),
        ];
    }

    /** @return array{answer: string, usage: array} */
    public function askWeekly(array $stats, string $language, array $report, string $question): array
    {
        $earlier = "Your {$stats['kind']}ly report:\n{$report['headline']}\n{$report['summary']}\nPlan: " . implode(' | ', $report['plan'] ?? []);
        foreach ($report['answers'] ?? [] as $qa) {
            $earlier .= "\n\nAthlete asked: {$qa['question']}\nYou answered: {$qa['answer']}";
        }

        $message = $this->call(
            $this->weeklyContext($stats, $language) . "\n\n" . $earlier
                . "\n\nThe athlete now asks:\n<question>\n{$question}\n</question>\n\n"
                . 'Answer in 2–5 sentences, specific to this period of their training. If the question is not about '
                . 'their training, fitness or sport, say briefly that you can only help with training.',
            null,
        );

        return ['answer' => trim($this->text($message)), 'usage' => $this->usage($message)];
    }

    private function weeklyContext(array $stats, string $language): string
    {
        return "Weekly data (JSON):\n" . json_encode(['language' => $language] + $stats, JSON_UNESCAPED_UNICODE);
    }

    private function call(string $prompt, ?array $format): mixed
    {
        $outputConfig = ['effort' => 'low'];
        if ($format) {
            $outputConfig['format'] = $format;
        }

        $message = $this->client->beta->messages->create(
            model: (string) config('services.anthropic.coach_model'),
            maxTokens: 16000,
            system: self::SYSTEM,
            messages: [['role' => 'user', 'content' => $prompt]],
            outputConfig: $outputConfig,
            // A refused request is retried on a model chosen by refusal category.
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );

        if ($message->stopReason === 'refusal') {
            throw new \RuntimeException('Coach declined this request.');
        }

        return $message;
    }

    private function text(mixed $message): string
    {
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                return $block->text;
            }
        }

        return '';
    }

    private function usage(mixed $message): array
    {
        return [
            'input_tokens'  => (int) ($message->usage->inputTokens ?? 0),
            'output_tokens' => (int) ($message->usage->outputTokens ?? 0),
        ];
    }

    /** Everything the coach knows about this training, as compact JSON. */
    private function context(Training $training, string $language): string
    {
        $detail = $training->detail
            ?? ($training->dedup_group_id
                ? TrainingDetail::whereIn('training_id', Training::where('dedup_group_id', $training->dedup_group_id)->pluck('id'))->first()
                : null);
        $d = $detail?->details ?? [];
        $s = $detail?->streams ?? [];
        $user = $training->user;

        $round = fn ($v, $p = 1) => $v === null ? null : round((float) $v, $p);
        $pace = fn ($mps) => $mps > 0 ? gmdate('i:s', (int) round(1000 / $mps)) . '/km' : null;

        $data = [
            'language' => $language,
            'athlete'  => array_filter([
                'age'    => $user?->birth_date ? $user->birth_date->age : null,
                'skill'  => $user?->skill_level,
            ]),
            'training' => array_filter([
                'sport'          => $training->category->value,
                'name'           => $training->name,
                'date'           => $training->started_at->toDateTimeString(),
                'indoor'         => $d['trainer'] ?? null,
                'device'         => $d['device_name'] ?? null,
                'distance_km'    => $round($training->distance_m ? $training->distance_m / 1000 : null, 2),
                'moving_time_min'=> $round($training->duration_s ? $training->duration_s / 60 : null),
                'avg_speed_kmh'  => $round($training->avg_speed_mps ? $training->avg_speed_mps * 3.6 : null),
                'avg_pace'       => $training->avg_speed_mps ? $pace($training->avg_speed_mps) : null,
                'elevation_gain_m' => $round($training->elevation_gain, 0),
                'avg_hr'         => $round($training->avg_heartrate, 0),
                'max_hr'         => $round($training->max_heartrate, 0),
                'avg_power_w'    => $round($training->avg_watts, 0),
                'normalized_power_w' => $round($d['weighted_average_watts'] ?? null, 0),
                'max_power_w'    => $round($training->max_watts, 0),
                'avg_cadence'    => $round($training->avg_cadence, 0),
                'calories'       => $round($training->calories, 0),
                'perceived_exertion' => $d['perceived_exertion'] ?? null,
                'description'    => $training->description,
            ], fn ($v) => $v !== null && $v !== ''),
            'km_splits' => array_map(fn ($sp) => array_filter([
                'km'    => $sp['split'] ?? null,
                'pace'  => $pace($sp['average_speed'] ?? 0),
                'hr'    => $round($sp['average_heartrate'] ?? null, 0),
                'elev'  => $round($sp['elevation_difference'] ?? null, 0),
            ], fn ($v) => $v !== null), array_slice($d['splits_metric'] ?? [], 0, 60)),
            'laps' => count($d['laps'] ?? []) > 1 ? array_map(fn ($l) => array_filter([
                'lap' => $l['lap_index'] ?? null, 'km' => $round(($l['distance'] ?? 0) / 1000, 2),
                'min' => $round(($l['moving_time'] ?? 0) / 60), 'hr' => $round($l['average_heartrate'] ?? null, 0),
                'w' => $round($l['average_watts'] ?? null, 0),
            ], fn ($v) => $v !== null), array_slice($d['laps'], 0, 40)) : null,
            'best_efforts' => array_map(fn ($e) => array_filter([
                'name' => $e['name'] ?? null, 'time' => gmdate('H:i:s', (int) ($e['moving_time'] ?? 0)),
                'personal_record' => ($e['pr_rank'] ?? null) === 1 ? true : null,
            ]), $d['best_efforts'] ?? []),
            'hr_zones_minutes' => self::zones($s, $user?->birth_date?->age, $training->max_heartrate),
            'recent_same_sport' => $this->history($training),
            'load' => $this->load($training),
        ];

        return "Training data (JSON):\n" . json_encode(array_filter($data, fn ($v) => $v !== null && $v !== []), JSON_UNESCAPED_UNICODE);
    }

    /** Minutes per HR zone (220 − age, else the highest HR seen) from a training's streams. */
    public static function zones(array $s, ?int $age, ?float $maxSeen): ?array
    {
        $hr = $s['heartrate'] ?? null;
        $time = $s['time'] ?? null;
        if (!$hr || !$time || count($hr) !== count($time)) {
            return null;
        }
        $max = $age ? 220 - $age : max($maxSeen ?: 0, max($hr));
        $bounds = ['Z1' => 0.5, 'Z2' => 0.6, 'Z3' => 0.7, 'Z4' => 0.8, 'Z5' => 0.9];
        $secs = array_fill_keys(array_keys($bounds), 0);
        foreach ($hr as $i => $v) {
            $dt = $i > 0 ? max(0, $time[$i] - $time[$i - 1]) : 0;
            $zone = null;
            foreach ($bounds as $z => $from) {
                if ($v >= $from * $max) {
                    $zone = $z;
                }
            }
            if ($zone) {
                $secs[$zone] += $dt;
            }
        }

        return ['max_hr_used' => $max] + array_map(fn ($sec) => round($sec / 60), $secs);
    }

    /** The athlete's last trainings of the same sport, before this one. */
    private function history(Training $training): array
    {
        return Training::where('user_id', $training->user_id)
            ->where('category', $training->category->value)
            ->where('is_primary', true)
            ->where('started_at', '<', $training->started_at)
            ->orderByDesc('started_at')
            ->limit(8)
            ->get()
            ->map(fn (Training $t) => array_filter([
                'date'   => $t->started_at->toDateString(),
                'km'     => $t->distance_m ? round($t->distance_m / 1000, 1) : null,
                'min'    => $t->duration_s ? round($t->duration_s / 60) : null,
                'kmh'    => $t->avg_speed_mps ? round($t->avg_speed_mps * 3.6, 1) : null,
                'hr'     => $t->avg_heartrate ? round($t->avg_heartrate) : null,
                'w'      => $t->avg_watts ? round($t->avg_watts) : null,
                'elev'   => $t->elevation_gain ? round($t->elevation_gain) : null,
            ]))
            ->values()
            ->all();
    }

    private function load(Training $training): array
    {
        $q = fn (int $days) => DB::table('trainings')
            ->where('user_id', $training->user_id)
            ->where('is_primary', true)
            ->whereBetween('started_at', [$training->started_at->copy()->subDays($days), $training->started_at])
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(duration_s), 0) as s')
            ->first();
        $w = $q(7);
        $m = $q(28);

        return [
            'last_7_days'  => ['trainings' => (int) $w->n, 'hours' => round($w->s / 3600, 1)],
            'last_28_days' => ['trainings' => (int) $m->n, 'hours' => round($m->s / 3600, 1)],
        ];
    }
}
