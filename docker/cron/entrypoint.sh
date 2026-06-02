#!/bin/sh
set -eu

apk add --no-cache curl > /dev/null

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET ontbreekt — cron container stopt."
  exit 1
fi

if [ -z "${APP_BASE_URL:-}" ]; then
  echo "APP_BASE_URL ontbreekt — cron container stopt."
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${CRON_SECRET}"

cat > /etc/crontabs/root <<EOF
# UTC — zelfde schema als voormalige Vercel crons (vercel.json)
25 13 * * 1-4 curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/packed-items-airtec/send-daily-report" >> /var/log/prodwilrijk-cron.log 2>&1
25 12 * * 5 curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/packed-items-airtec/send-daily-report" >> /var/log/prodwilrijk-cron.log 2>&1
2 5 * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/pils-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
5 10 * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/pils-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
5 14 * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/pils-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
2 14 * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/packed-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
*/10 * * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/kist-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
7,22,37,52 * * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/grote-inpak/forecast-mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
*/10 * * * * curl -fsS -H "${AUTH_HEADER}" "${APP_BASE_URL}/api/lumipaper/mail-import" >> /var/log/prodwilrijk-cron.log 2>&1
EOF

echo "Prodwilrijk cron gestart (UTC, base URL: ${APP_BASE_URL})"
crond -f -l 2
