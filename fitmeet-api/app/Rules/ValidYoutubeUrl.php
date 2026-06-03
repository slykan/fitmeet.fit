<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidYoutubeUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->videoId($value)) {
            $fail('Enter a valid YouTube URL.');
        }
    }

    private function videoId(string $value): ?string
    {
        $input = $this->normalize($value);
        $parts = parse_url($input);
        if (! is_array($parts)) {
            return $this->fallbackVideoId($input);
        }

        $scheme = strtolower($parts['scheme'] ?? '');
        if (! in_array($scheme, ['http', 'https'], true)) {
            return $this->fallbackVideoId($input);
        }

        $host = strtolower($parts['host'] ?? '');
        $host = preg_replace('/^(www\.|m\.|music\.)/', '', $host) ?? $host;
        $path = trim($parts['path'] ?? '', '/');

        if ($host === 'youtu.be') {
            return $this->validVideoId(explode('/', $path)[0] ?? null);
        }

        if (! in_array($host, ['youtube.com', 'youtube-nocookie.com'], true)) {
            return null;
        }

        if ($path === 'watch') {
            parse_str($parts['query'] ?? '', $query);

            return $this->validVideoId($query['v'] ?? null);
        }

        $segments = $path === '' ? [] : explode('/', $path);
        if (in_array($segments[0] ?? '', ['shorts', 'embed', 'live'], true)) {
            return $this->validVideoId($segments[1] ?? null);
        }

        return $this->fallbackVideoId($input);
    }

    private function validVideoId(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^[A-Za-z0-9_-]{11}$/', $value)
            ? $value
            : null;
    }

    private function normalize(string $value): string
    {
        return preg_replace('/\s+/', '', html_entity_decode(trim($value), ENT_QUOTES | ENT_HTML5)) ?? '';
    }

    private function fallbackVideoId(string $value): ?string
    {
        if (! preg_match('/^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#\/].*)?$/i', $value, $matches)) {
            return null;
        }

        return $this->validVideoId($matches[1] ?? null);
    }
}
