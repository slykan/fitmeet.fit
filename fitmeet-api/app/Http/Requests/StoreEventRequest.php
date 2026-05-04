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
            'image_file'       => ['nullable', 'file', 'max:8192'],

            'skill_level'      => ['nullable', Rule::in(['beginner', 'advanced', 'pro'])],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:9999'],
            'is_private'       => ['boolean'],
        ];
    }
}
