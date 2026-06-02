#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "=== Prodwilrijk on-premise deploy ==="

if [ ! -f .env.production ]; then
  cp .env.docker.example .env.production
  echo "Aangemaakt: .env.production — vul ontbrekende waarden in (SMTP, IMAP, CRON_SECRET, ...)"
fi

echo ""
echo "1/4 Supabase starten..."
(
  cd docker/supabase
  chmod +x *.sh
  ./up.sh
)

echo ""
echo "2/4 App env synchroniseren..."
(
  cd docker/supabase
  ./sync-app-env.sh
)

echo ""
echo "3/4 Database-migraties..."
(
  cd docker/supabase
  ./run-migrations.sh
)

echo ""
echo "4/4 Next.js app + cron starten..."
docker compose --env-file .env.production up -d --build

echo ""
echo "Deploy voltooid."
echo "  App:      http://127.0.0.1:${APP_PORT:-3000}"
echo "  Supabase: http://127.0.0.1:8000"
echo "  Studio:   http://127.0.0.1:3001"
