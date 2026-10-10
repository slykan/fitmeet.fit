<?php

namespace App\Services;

use App\Models\Training;
use App\Models\TrainingDetail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The last 7 days of a user's trainings: per-day minutes by sport (bar chart), totals
 * vs the previous 4 weeks, sports mix, heart-rate zone minutes (where streams exist),
 * personal records and the training list. Pure numbers — free to compute; the AI
 * weekly report is written from this.
 */
class WeeklyStats
{
    /** Period length and how many earlier periods the totals are compared with. */
    public const PERIODS = [
        'week'  => ['days' => 7, 'compare' => 4],
        'month' => ['days' => 30, 'compare' => 3],
    ];

    public function forUser(User $user, ?Carbon $today = null, string $kind = 'week'): array
    {
        ['days' => $length, 'compare' => $compare] = self::PERIODS[$kind] ?? self::PERIODS['week'];
        $tz = config('app.timezone');
        $end = ($today ?? now($tz))->copy()->endOfDay();
        $start = $end->copy()->subDays($length - 1)->startOfDay();

        $week = $this->trainings($user, $start, $end);

        $days = [];
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $dayTrainings = $week->filter(fn (Training $t) => $t->started_at->copy()->tz($tz)->isSameDay($d));
            $bySport = [];
            foreach ($dayTrainings as $t) {
                $bySport[$t->category->value] = ($bySport[$t->category->value] ?? 0) + round(($t->duration_s ?? 0) / 60);
            }
            $days[] = [
                'date'     => $d->toDateString(),
                'minutes'  => array_sum($bySport),
                'by_sport' => $bySport,
            ];
        }

        // The previous periods (4 weeks / 3 months), as an average period of the same length.
        $prev = $this->trainings($user, $start->copy()->subDays($length * $compare), $start->copy()->subSecond());
        $prevAvg = [
            'trainings' => round($prev->count() / $compare, 1),
            'hours'     => round($prev->sum('duration_s') / 3600 / $compare, 1),
            'km'        => round($prev->sum('distance_m') / 1000 / $compare, 1),
        ];

        $sports = $week->groupBy(fn (Training $t) => $t->category->value)->map(fn (Collection $g, $key) => [
            'sport'     => $key,
            'label'     => $g->first()->category->label(),
            'trainings' => $g->count(),
            'minutes'   => (int) round($g->sum('duration_s') / 60),
            'km'        => round($g->sum('distance_m') / 1000, 1),
        ])->sortByDesc('minutes')->values()->all();

        [$zones, $prs] = $this->zonesAndRecords($user, $week);

        return [
            'kind'     => $kind,
            'period'   => ['start' => $start->toDateString(), 'end' => $end->toDateString(), 'days' => $length],
            'totals'   => [
                'trainings'   => $week->count(),
                'hours'       => round($week->sum('duration_s') / 3600, 1),
                'km'          => round($week->sum('distance_m') / 1000, 1),
                'elevation_m' => (int) round($week->sum('elevation_gain')),
                'calories'    => (int) round($week->sum('calories')),
                'active_days' => count(array_filter($days, fn ($d) => $d['minutes'] > 0)),
            ],
            'previous_avg' => $prevAvg + ['periods' => $compare],
            'previous_4_weeks_avg' => $prevAvg, // app 1.4.49 reads this name
            'days'      => $days,
            'sports'    => $sports,
            'hr_zones_minutes' => $zones,
            'personal_records' => $prs,
            'trainings' => $week->map(fn (Training $t) => array_filter([
                'id'    => $t->id,
                'date'  => $t->started_at->copy()->tz($tz)->toDateString(),
                'sport' => $t->category->value,
                'name'  => $t->name,
                'km'    => $t->distance_m ? round($t->distance_m / 1000, 1) : null,
                'min'   => $t->duration_s ? (int) round($t->duration_s / 60) : null,
                'hr'    => $t->avg_heartrate ? (int) round($t->avg_heartrate) : null,
                'w'     => $t->avg_watts ? (int) round($t->avg_watts) : null,
                'elev'  => $t->elevation_gain ? (int) round($t->elevation_gain) : null,
            ], fn ($v) => $v !== null))->values()->all(),
            'last_training_at' => $week->max('started_at')?->toIso8601String(),
        ];
    }

    private function trainings(User $user, Carbon $from, Carbon $to): Collection
    {
        return Training::with('detail')
            ->where('user_id', $user->id)
            ->where('is_primary', true)
            ->whereBetween('started_at', [$from, $to])
            ->orderBy('started_at')
            ->get();
    }

    /** HR zone minutes summed over the week, and best-effort PRs set this week. */
    private function zonesAndRecords(User $user, Collection $week): array
    {
        $sum = null;
        $prs = [];
        $age = $user->birth_date?->age;

        foreach ($week as $t) {
            $detail = $t->detail ?? ($t->dedup_group_id
                ? TrainingDetail::whereIn('training_id', Training::where('dedup_group_id', $t->dedup_group_id)->pluck('id'))->first()
                : null);
            if (!$detail) {
                continue;
            }
            $z = TrainingCoach::zones($detail->streams ?? [], $age, $t->max_heartrate);
            if ($z) {
                unset($z['max_hr_used']);
                foreach ($z as $zone => $min) {
                    $sum[$zone] = ($sum[$zone] ?? 0) + $min;
                }
            }
            foreach ($detail->details['best_efforts'] ?? [] as $e) {
                if (($e['pr_rank'] ?? null) === 1) {
                    $prs[] = ['name' => $e['name'], 'time' => gmdate('H:i:s', (int) ($e['moving_time'] ?? 0)), 'training_id' => $t->id];
                }
            }
        }

        return [$sum, $prs];
    }
}
