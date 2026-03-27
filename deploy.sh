#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/scratchbox"
BRANCH="main"

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: $APP_DIR not found. Clone your repo there first."
  exit 1
fi

cd "$APP_DIR"

echo "==> Pulling latest code"
git fetch --all
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi
git pull origin "$BRANCH"

echo "==> Installing dependencies"
npm install

echo "==> Building site"
npm run build

echo "==> Restarting PM2"
if pm2 list | grep -q "scratchbox-web"; then
  pm2 restart ecosystem.config.js --update-env
else
  npm run serve:prod
fi

pm2 save

echo "==> Done."
