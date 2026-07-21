#!/bin/bash
set -e

REPO=~/fitmeet-web
API=~/public_html/api.fitmeet.fit

# ─── Git pull ────────────────────────────────────────────────────────────────
echo "→ git pull..."
cd $REPO
git checkout fitmeet-web/package-lock.json 2>/dev/null || true
git pull origin main

# ─── Sync API files ──────────────────────────────────────────────────────────
echo "→ sync API files..."
cp -r $REPO/fitmeet-api/app/Http/Controllers/Api/. $API/app/Http/Controllers/Api/
cp -r $REPO/fitmeet-api/app/Http/Resources/.        $API/app/Http/Resources/
cp -r $REPO/fitmeet-api/app/Http/Requests/.         $API/app/Http/Requests/
mkdir -p $API/app/Http/Middleware
cp -r $REPO/fitmeet-api/app/Http/Middleware/.       $API/app/Http/Middleware/
cp -r $REPO/fitmeet-api/app/Models/.                $API/app/Models/
cp -r $REPO/fitmeet-api/app/Mail/.                  $API/app/Mail/
cp -r $REPO/fitmeet-api/app/Jobs/.                  $API/app/Jobs/
cp -r $REPO/fitmeet-api/app/Services/.              $API/app/Services/
cp -r $REPO/fitmeet-api/app/Enums/.                 $API/app/Enums/
cp -r $REPO/fitmeet-api/database/migrations/.       $API/database/migrations/
cp    $REPO/fitmeet-api/routes/api.php              $API/routes/
cp    $REPO/fitmeet-api/routes/console.php          $API/routes/
cp    $REPO/fitmeet-api/config/services.php         $API/config/
cp -r $REPO/fitmeet-api/resources/views/emails/.    $API/resources/views/emails/

# ─── Laravel ─────────────────────────────────────────────────────────────────
echo "→ migrate + clear cache..."
php $API/artisan migrate --force
php $API/artisan config:clear
php $API/artisan route:clear
php $API/artisan cache:clear

# ─── Build web ───────────────────────────────────────────────────────────────
echo "→ npm install + build..."
cd $REPO/fitmeet-web
npm install --legacy-peer-deps
npm run build

# ─── Deploy web ──────────────────────────────────────────────────────────────
echo "→ deploy web..."
cp -rf dist/* ~/public_html/ 2>/dev/null || true

echo "✓ Deployed!"
