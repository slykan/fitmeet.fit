<?php

namespace App\Services;

class ContentFilterService
{
    /**
     * Deliberately short and conservative — this is the proactive precaution
     * Apple's guideline 1.2 asks for, paired with the reactive report/block/
     * removal pipeline (ReportController, UserBlockController, AdminReportController).
     * Keep additions lowercase, no word-boundary tricks needed since we check
     * on normalized/lowercased text with simple substring matching.
     */
    private const BLOCKED_TERMS = [
        'nigger', 'nigga', 'faggot', 'retard',
        'kill yourself', 'kys',
        'child porn', 'cp link',
    ];

    public static function containsObjectionableContent(?string $text): bool
    {
        if (! $text) {
            return false;
        }

        $normalized = mb_strtolower($text);

        foreach (self::BLOCKED_TERMS as $term) {
            if (str_contains($normalized, $term)) {
                return true;
            }
        }

        return false;
    }
}
