#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

./bootstrap.sh

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Aangemaakt: docker/supabase/.env"
fi

if [ ! -f vendor/utils/generate-keys.sh ]; then
  echo "vendor/utils/generate-keys.sh niet gevonden. Draai eerst ./bootstrap.sh"
  exit 1
fi

(
  cd vendor
  ln -sf ../.env .env
  sh utils/generate-keys.sh "$@"
)

echo ""
echo "Kopieer ANON_KEY en SERVICE_ROLE_KEY naar de root .env.production:"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>"
echo "  SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>"
echo ""
echo "Of draai: ./sync-app-env.sh"
