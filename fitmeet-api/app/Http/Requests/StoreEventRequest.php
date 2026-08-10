<?php

namespace App\Http\Requests;

use App\Enums\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'            => ['required', 'string', 'max:100'],
            'description'      => ['nullable', 'string', 'max:2000'],
            'category'         => ['required', Rule::in(Category::values())],
            'client_request_id' => ['nullable', 'string', 'max:64'],

            'lat'              => ['required', 'numeric', 'between:-90,90'],
            'lng'              => ['required', 'numeric', 'between:-180,180'],
            'address'          => ['nullable', 'string', 'max:255'],
            'timezone'         => ['required', 'string', 'timezone'],

            'start_at'         => ['required', 'date', 'after:now'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:1440'],

            'distance_km'      => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'elevation_gain'   => ['nullable', 'integer', 'min:0'],
            'pace'             => ['nullable', 'string', 'max:20'],
            'max_grade'        => ['nullable', 'numeric', 'min:0', 'max:100'],
            'max_downgrade'    => ['nullable', 'numeric', 'min:-100', 'max:0'],

            'gpx_file'         => ['nullable', 'file', 'max:8192'],
            'gpx_text'         => ['nullable', 'string', 'max:8388608'],
            'gpx_name'         => ['nullable', 'string', 'max:120'],
            'route_title'      => ['nullable', 'string', 'max:140'],
            'route_id'         => ['nullable', 'integer', 'exists:routes,id'],
            'image_file'       => ['nullable', 'file', 'max:8192'],

            'skill_level'      => ['nullable', Rule::in(['beginner', 'advanced', 'pro'])],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:9999'],
            'is_private'       => ['boolean'],
            'youtube_url'      => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_string($value) || ! $this->isValidYoutubeUrl($value)) {
                        $fail('Enter a valid YouTube URL.');
                    }
                },
            ],
            'link_url'         => ['nullable', 'string', 'url', 'max:500'],
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
