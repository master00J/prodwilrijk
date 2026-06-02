#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ ! -f vendor/docker-compose.yml ]; then
  echo "Supabase vendor ontbreekt. Niets te stoppen."
  exit 0
fi

cd vendor
docker compose \
  --env-file ../.env \
  -f docker-compose.yml \
  -f ../docker-compose.prodwilrijk.yml \
  down

echo "Supabase gestopt."
