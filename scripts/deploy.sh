#!/usr/bin/env bash
# Server-side deploy for the staging cloud demo. Run from the repo root on the
# server (the GitHub Action calls this over SSH). Idempotent.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.bun/bin:$PATH"

APP_NAME="${APP_NAME:-paperio-staging}"
BRANCH="${DEPLOY_BRANCH:-staging}"

# Load env (DATABASE_URL, PORT, ORIGIN, MINIMAX_API_KEY, …) for migrate/seed/run.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

echo "[deploy] sync $BRANCH"
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"

echo "[deploy] install deps"
bun install --frozen-lockfile

echo "[deploy] db migrate"
bun run db:migrate

echo "[deploy] seed templates/plans + demo + ai"
bun run db:seed
bun run scripts/seed-demo.ts

echo "[deploy] build"
bun run build

echo "[deploy] (re)start pm2 app $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
	pm2 reload "$APP_NAME" --update-env
else
	pm2 start build/index.js --name "$APP_NAME" --update-env
fi
pm2 save

echo "[deploy] done -> $APP_NAME on PORT=${PORT:-3000}"
