#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SUPABASE_ENV="${SCRIPT_DIR}/.env"
APP_ENV="${ROOT_DIR}/.env.production"

if [ ! -f "${SUPABASE_ENV}" ]; then
  echo "Ontbreekt: docker/supabase/.env — draai eerst ./generate-env.sh --update-env"
  exit 1
fi

if [ ! -f "${APP_ENV}" ]; then
  cp "${ROOT_DIR}/.env.docker.example" "${APP_ENV}"
  echo "Aangemaakt: .env.production"
fi

get_env_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "${file}" | head -n 1 | cut -d= -f2- | tr -d '\r'
}

ANON_KEY="$(get_env_value ANON_KEY "${SUPABASE_ENV}")"
SERVICE_ROLE_KEY="$(get_env_value SERVICE_ROLE_KEY "${SUPABASE_ENV}")"
SUPABASE_PUBLIC_URL="$(get_env_value SUPABASE_PUBLIC_URL "${SUPABASE_ENV}")"

if [ -z "${ANON_KEY}" ] || [ "${ANON_KEY}" = "CHANGE_ME" ]; then
  echo "ANON_KEY ontbreekt in docker/supabase/.env"
  exit 1
fi

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -q "^${key}=" "${file}"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

set_env_value "NEXT_PUBLIC_SUPABASE_URL" "${SUPABASE_PUBLIC_URL:-https://api.prodwilrijk.be}" "${APP_ENV}"
set_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${ANON_KEY}" "${APP_ENV}"
set_env_value "SUPABASE_SERVICE_ROLE_KEY" "${SERVICE_ROLE_KEY}" "${APP_ENV}"

rm -f "${APP_ENV}.bak"

echo "Gesynchroniseerd naar .env.production:"
echo "  NEXT_PUBLIC_SUPABASE_URL"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  SUPABASE_SERVICE_ROLE_KEY"
