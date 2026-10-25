<?php

namespace App\Services;

use Anthropic\Client;

/**
 * Health › Food: estimates calories and macros of a meal or drink described in free text
 * (any language). Small fast model; the user can still correct the numbers before saving.
 */
class MealEstimator
{
    private const SYSTEM = <<<'TXT'
You estimate the nutrition of food and drinks people log in a fitness app. The description can
be in any language (often Croatian) and is usually short and informal ("2 jaja i kruh s maslacem",
"burek sa sirom", "pivo 0,5"). Split it into items and estimate each one realistically:
- Use typical portions for the region when no amount is given (e.g. Croatian bakery burek ≈ 300 g,
  a slice of bread ≈ 40 g, a beer = 0.5 l, a coffee with milk = espresso + ~50 ml milk).
- kcal and grams of protein, carbs and fat per item, rounded sensibly. Plain water = 0 kcal.
- Item names short, in the same language as the description, with the assumed amount
  (e.g. "Jaja, 2 kom (≈110 g)").
- kind = "drink" only if everything is a drink, else "meal"; volume_ml = total liquid of the drinks (0 if none).
- note: one short sentence (same language) on the main assumption, or "" if nothing to add.
If the text is not food or drink, return no items.
TXT;

    private Client $client;

    public function __construct()
    {
        $this->client = new Client(apiKey: (string) config('services.anthropic.api_key'));
    }

    /** @return array{items: array, kind: string, volume_ml: int, note: string, kcal: int, protein_g: float, carbs_g: float, fat_g: float, usage: array} */
    public function estimate(string $description, string $language): array
    {
        $num = ['type' => 'number'];
        $message = $this->client->beta->messages->create(
            model: (string) config('services.anthropic.meal_model'),
            maxTokens: 2000,
            system: self::SYSTEM,
            messages: [['role' => 'user', 'content' => "Language of the app user: {$language}\nFood log entry:\n<entry>\n{$description}\n</entry>"]],
            outputConfig: ['format' => [
                'type'   => 'json_schema',
                'schema' => [
                    'type'       => 'object',
                    'properties' => [
                        'items' => ['type' => 'array', 'items' => [
                            'type'       => 'object',
                            'properties' => ['name' => ['type' => 'string'], 'kcal' => $num, 'protein_g' => $num, 'carbs_g' => $num, 'fat_g' => $num],
                            'required'   => ['name', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
                            'additionalProperties' => false,
                        ]],
                        'kind'      => ['type' => 'string', 'enum' => ['meal', 'drink']],
                        'volume_ml' => $num,
                        'note'      => ['type' => 'string'],
                    ],
                    'required'             => ['items', 'kind', 'volume_ml', 'note'],
                    'additionalProperties' => false,
                ],
            ]],
        );
        if ($message->stopReason === 'refusal') {
            throw new \RuntimeException('Estimate declined.');
        }

        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text = $block->text;
                break;
            }
        }
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new \RuntimeException('No estimate returned.');
        }

        $items = array_values(array_map(fn ($i) => [
            'name'      => mb_substr((string) $i['name'], 0, 120),
            'kcal'      => max(0, (int) round((float) $i['kcal'])),
            'protein_g' => max(0, round((float) $i['protein_g'], 1)),
            'carbs_g'   => max(0, round((float) $i['carbs_g'], 1)),
            'fat_g'     => max(0, round((float) $i['fat_g'], 1)),
        ], array_slice($data['items'] ?? [], 0, 20)));

        return [
            'items'     => $items,
            'kind'      => ($data['kind'] ?? 'meal') === 'drink' ? 'drink' : 'meal',
            'volume_ml' => max(0, min(5000, (int) round((float) ($data['volume_ml'] ?? 0)))),
            'note'      => mb_substr((string) ($data['note'] ?? ''), 0, 300),
            'kcal'      => array_sum(array_column($items, 'kcal')),
            'protein_g' => round(array_sum(array_column($items, 'protein_g')), 1),
            'carbs_g'   => round(array_sum(array_column($items, 'carbs_g')), 1),
            'fat_g'     => round(array_sum(array_column($items, 'fat_g')), 1),
            'usage'     => [
                'input_tokens'  => (int) ($message->usage->inputTokens ?? 0),
                'output_tokens' => (int) ($message->usage->outputTokens ?? 0),
            ],
        ];
    }
}
