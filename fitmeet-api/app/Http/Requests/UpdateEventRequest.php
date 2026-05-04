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
            'image_file'       => ['sometimes', 'nullable', 'file', 'max:8192'],
            'image_remove'     => ['sometimes', 'boolean'],

            'skill_level'      => ['sometimes', 'nullable', Rule::in(['beginner', 'advanced', 'pro'])],
            'max_participants' => ['sometimes', 'nullable', 'integer', 'min:2'],
            'is_private'       => ['sometimes', 'boolean'],
        ];
    }
}
