#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_DIR="${SCRIPT_DIR}/vendor"
SUPABASE_REF="${SUPABASE_DOCKER_REF:-master}"

if [ -f "${VENDOR_DIR}/docker-compose.yml" ]; then
  echo "Supabase Docker vendor is al aanwezig in docker/supabase/vendor/"
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is vereist om de officiële Supabase Docker stack te downloaden."
  exit 1
fi

echo "Download officiële Supabase Docker stack (${SUPABASE_REF})..."
TMP_DIR="${SCRIPT_DIR}/.tmp-supabase"
rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}"

git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git "${TMP_DIR}"
(
  cd "${TMP_DIR}"
  git sparse-checkout set docker
)

mkdir -p "${VENDOR_DIR}"
cp -R "${TMP_DIR}/docker/." "${VENDOR_DIR}/"
rm -rf "${TMP_DIR}"

echo "Klaar: docker/supabase/vendor/"
