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
            'home_city'    => ['sometimes', 'required', 'string', 'max:100'],
            'home_country' => ['sometimes', 'required', 'string', 'max:100'],

            'radius'       => ['sometimes', Rule::in(['nearby', 'city', 'region', 'unlimited'])],

            'categories'   => ['sometimes', 'array', 'min:1', 'max:10'],
            'categories.*' => ['string', Rule::in(Category::values())],

            'skill_level'  => ['sometimes', 'nullable', Rule::in(['beginner', 'advanced', 'pro'])],
            'birth_date'   => ['sometimes', 'nullable', 'date', 'before:today', 'after:1900-01-01'],

            'hide_phone'   => ['sometimes', 'boolean'],
            'email_friend_requests' => ['sometimes', 'boolean'],
            'email_new_events'      => ['sometimes', 'boolean'],
            'email_event_reminders' => ['sometimes', 'boolean'],
            'email_friend_events'   => ['sometimes', 'boolean'],
            'push_notifications'    => ['sometimes', 'boolean'],
            'auto_share_live_location' => ['sometimes', 'boolean'],
            'auto_check_in' => ['sometimes', 'boolean'],
            'hr_max'       => ['sometimes', 'nullable', 'integer', 'between:120,230'],
            // five ascending lower bounds (Z1..Z5) in bpm, or null for zones from max HR
            'hr_zones'     => ['sometimes', 'nullable', 'array', 'size:5', function ($attribute, $value, $fail) {
                $value = array_values((array) $value);
                for ($i = 1; $i < count($value); $i++) {
                    if ((int) $value[$i] <= (int) $value[$i - 1]) {
                        $fail('Each zone must start higher than the one before (Z1 < Z2 < … < Z5).');
                        return;
                    }
                }
            }],
            'hr_zones.*'   => ['integer', 'between:40,230'],
            'hr_rest'      => ['sometimes', 'nullable', 'integer', 'between:30,110'],
            'hr_zone_method' => ['sometimes', 'nullable', 'in:max,hrr,manual'],
            'share_trainings_in_feed' => ['sometimes', 'boolean'],
            'fcm_token'    => ['sometimes', 'nullable', 'string'],
            'avatar_file'  => ['sometimes', 'nullable', 'file', 'max:8192'],
            'avatar_remove' => ['sometimes', 'boolean'],
        ];
    }
}
