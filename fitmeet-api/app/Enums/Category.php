<?php

namespace App\Enums;

enum Category: string
{
    // Sports
    case Running      = 'running';
    case Cycling      = 'cycling';
    case Hiking       = 'hiking';
    case Swimming     = 'swimming';
    case Football     = 'football';
    case Basketball   = 'basketball';
    case Tennis       = 'tennis';
    case Volleyball   = 'volleyball';
    case Yoga         = 'yoga';
    case Fitness      = 'fitness';
    case MartialArts  = 'martial_arts';
    case Skiing       = 'skiing';
    case Surfing      = 'surfing';
    case Climbing     = 'climbing';
    case Padel        = 'padel';

    // Social
    case Party        = 'party';
    case Chill        = 'chill';
    case FoodDrinks   = 'food_drinks';
    case Music        = 'music';
    case Gaming       = 'gaming';

    // Outdoor
    case Beach        = 'beach';
    case Camping      = 'camping';
    case Kayaking     = 'kayaking';

    // Culture
    case Photography  = 'photography';
    case Art          = 'art';

    public function label(): string
    {
        return match($this) {
            self::Running     => 'Running',
            self::Cycling     => 'Cycling',
            self::Hiking      => 'Hiking',
            self::Swimming    => 'Swimming',
            self::Football    => 'Football',
            self::Basketball  => 'Basketball',
            self::Tennis      => 'Tennis',
            self::Volleyball  => 'Volleyball',
            self::Yoga        => 'Yoga',
            self::Fitness     => 'Fitness',
            self::MartialArts => 'Martial Arts',
            self::Skiing      => 'Skiing',
            self::Surfing     => 'Surfing',
            self::Climbing    => 'Climbing',
            self::Padel       => 'Padel',
            self::Party       => 'Party',
            self::Chill       => 'Chill',
            self::FoodDrinks  => 'Food & Drinks',
            self::Music       => 'Music',
            self::Gaming      => 'Gaming',
            self::Beach       => 'Beach',
            self::Camping     => 'Camping',
            self::Kayaking    => 'Kayaking',
            self::Photography => 'Photography',
            self::Art         => 'Art',
        };
    }

    public function group(): string
    {
        return match($this) {
            self::Running, self::Cycling, self::Hiking, self::Swimming,
            self::Football, self::Basketball, self::Tennis, self::Volleyball,
            self::Yoga, self::Fitness, self::MartialArts, self::Skiing,
            self::Surfing, self::Climbing, self::Padel => 'Sports',

            self::Party, self::Chill, self::FoodDrinks,
            self::Music, self::Gaming => 'Social',

            self::Beach, self::Camping, self::Kayaking => 'Outdoor',

            self::Photography, self::Art => 'Culture',
        };
    }

    public static function grouped(): array
    {
        $grouped = [];
        foreach (self::cases() as $case) {
            $grouped[$case->group()][] = [
                'value' => $case->value,
                'label' => $case->label(),
            ];
        }
        return $grouped;
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
