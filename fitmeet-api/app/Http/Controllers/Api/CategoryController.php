<?php

namespace App\Http\Controllers\Api;

use App\Enums\Category;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Category::grouped(),
        ]);
    }
}
