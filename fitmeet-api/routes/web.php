<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('https://fitmeet.fit', 301));
