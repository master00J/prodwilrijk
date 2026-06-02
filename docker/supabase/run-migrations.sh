#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/supabase/migrations"

if ! docker ps --format '{{.Names}}' | grep -qx 'supabase-db'; then
  echo "Container supabase-db draait niet. Start eerst ./up.sh"
  exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "Migratiemap niet gevonden: ${MIGRATIONS_DIR}"
  exit 1
fi

echo "Database-migraties toepassen op supabase-db..."
count=0

while IFS= read -r migration; do
  echo "→ $(basename "${migration}")"
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "${migration}"
  count=$((count + 1))
done < <(find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' | sort)

echo ""
echo "${count} migratie(s) toegepast."
