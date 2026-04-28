<?php

namespace App\Http\Requests;

use App\Enums\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'         => ['sometimes', 'string', 'max:100'],
            'phone'        => ['sometimes', 'nullable', 'string', 'max:20'],

            // Active location
            'lat'          => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'lng'          => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],

            // Home location
            'home_lat'     => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'home_lng'     => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'home_city'    => ['sometimes', 'nullable', 'string', 'max:100'],
            'home_country' => ['sometimes', 'nullable', 'string', 'max:100'],

            'radius'       => ['sometimes', Rule::in(['nearby', 'city', 'region', 'unlimited'])],

            'categories'   => ['sometimes', 'array', 'min:1', 'max:10'],
            'categories.*' => ['string', Rule::in(Category::values())],

            'skill_level'  => ['sometimes', 'nullable', Rule::in(['beginner', 'advanced', 'pro'])],

            'hide_phone'   => ['sometimes', 'boolean'],
            'email_friend_requests' => ['sometimes', 'boolean'],
            'email_new_events'      => ['sometimes', 'boolean'],
            'email_event_reminders' => ['sometimes', 'boolean'],
            'email_friend_events'   => ['sometimes', 'boolean'],
            'fcm_token'    => ['sometimes', 'nullable', 'string'],
            'avatar_file'  => ['sometimes', 'nullable', 'file', 'max:5120', 'mimetypes:image/jpeg,image/jpg,image/png,image/gif,image/bmp,image/svg+xml,image/webp,image/heic,image/heif,image/avif'],
            'avatar_remove' => ['sometimes', 'boolean'],
        ];
    }
}
