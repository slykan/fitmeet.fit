<?php

namespace App\Http\Requests;

use App\Enums\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'            => ['sometimes', 'string', 'max:100'],
            'description'      => ['sometimes', 'nullable', 'string', 'max:2000'],
            'category'         => ['sometimes', Rule::in(Category::values())],

            'lat'              => ['sometimes', 'numeric', 'between:-90,90'],
            'lng'              => ['sometimes', 'numeric', 'between:-180,180'],
            'address'          => ['sometimes', 'nullable', 'string', 'max:255'],
            'timezone'         => ['sometimes', 'string', 'timezone'],

            'start_at'         => ['sometimes', 'date', 'after:now'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:5', 'max:1440'],

            'distance_km'      => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'elevation_gain'   => ['sometimes', 'nullable', 'integer', 'min:0'],
            'pace'             => ['sometimes', 'nullable', 'string', 'max:20'],
            'max_grade'        => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'max_downgrade'    => ['sometimes', 'nullable', 'numeric', 'min:-100', 'max:0'],

            'gpx_file'         => ['sometimes', 'nullable', 'file', 'max:8192'],
            'gpx_text'         => ['sometimes', 'nullable', 'string', 'max:8388608'],
            'gpx_name'         => ['sometimes', 'nullable', 'string', 'max:120'],
            'route_title'      => ['sometimes', 'nullable', 'string', 'max:140'],
            'route_id'         => ['sometimes', 'nullable', 'integer', 'exists:routes,id'],
            'gpx_remove'       => ['sometimes', 'boolean'],
            'image_file'       => ['sometimes', 'nullable', 'file', 'max:8192'],
            'image_remove'     => ['sometimes', 'boolean'],
            'youtube_url'      => [
                'sometimes',
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_string($value) || ! $this->isValidYoutubeUrl($value)) {
                        $fail('Enter a valid YouTube URL.');
                    }
                },
            ],

            'skill_level'      => ['sometimes', 'nullable', Rule::in(['beginner', 'advanced', 'pro'])],
            'max_participants' => ['sometimes', 'nullable', 'integer', 'min:2'],
            'is_private'       => ['sometimes', 'boolean'],
        ];
    }

    private function isValidYoutubeUrl(string $value): bool
    {
        $input = preg_replace('/\s+/', '', html_entity_decode(trim($value), ENT_QUOTES | ENT_HTML5)) ?? '';
        $parts = parse_url($input);

        if (is_array($parts)) {
            $scheme = strtolower($parts['scheme'] ?? '');
            $host = strtolower($parts['host'] ?? '');
            $host = preg_replace('/^(www\.|m\.|music\.)/', '', $host) ?? $host;
            $path = trim($parts['path'] ?? '', '/');

            if (in_array($scheme, ['http', 'https'], true)) {
                if ($host === 'youtu.be' && $this->isValidYoutubeId(explode('/', $path)[0] ?? null)) {
                    return true;
                }

                if (in_array($host, ['youtube.com', 'youtube-nocookie.com'], true)) {
                    if ($path === 'watch') {
                        parse_str($parts['query'] ?? '', $query);

                        return $this->isValidYoutubeId($query['v'] ?? null);
                    }

                    $segments = $path === '' ? [] : explode('/', $path);
                    if (in_array($segments[0] ?? '', ['shorts', 'embed', 'live'], true)) {
                        return $this->isValidYoutubeId($segments[1] ?? null);
                    }
                }
            }
        }

        return (bool) preg_match('/^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}(?:[?&#\/].*)?$/i', $input);
    }

    private function isValidYoutubeId(mixed $value): bool
    {
        return is_string($value) && (bool) preg_match('/^[A-Za-z0-9_-]{11}$/', $value);
    }
}
