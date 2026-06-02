#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

./bootstrap.sh

if [ ! -f .env ]; then
  echo "Geen .env gevonden. Kopieer .env.example en genereer secrets:"
  echo "  cp .env.example .env"
  echo "  ./generate-env.sh --update-env"
  exit 1
fi

if grep -q "CHANGE_ME" .env; then
  echo "docker/supabase/.env bevat nog CHANGE_ME waarden."
  echo "Draai: ./generate-env.sh --update-env"
  exit 1
fi

docker network inspect prodwilrijk >/dev/null 2>&1 || docker network create prodwilrijk

cd vendor
docker compose \
  --env-file ../.env \
  -f docker-compose.yml \
  -f ../docker-compose.prodwilrijk.yml \
  up -d

echo ""
echo "Supabase gestart."
echo "  Kong API (lokaal):  http://127.0.0.1:8000"
echo "  Studio (lokaal):    http://127.0.0.1:3001"
echo "  Postgres (lokaal):  127.0.0.1:5432"
echo ""
echo "Volgende stappen:"
echo "  ./sync-app-env.sh"
echo "  ./run-migrations.sh"
echo "  cd ../.. && docker compose --env-file .env.production up -d --build"
