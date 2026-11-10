#!/usr/bin/env bash
# Launch the Farmyzest standalone server with the FULL runtime env.
#
# The standalone build (`output: "standalone"`) runs as plain `node server.js`,
# which — unlike `next start` — does NOT read .env files at runtime. So every
# environment variable must be injected into the process by us. We source BOTH
# on-box env files (they live in the repo root on the box and survive deploys,
# gitignored):
#   .env.production        infra: DATABASE_URL, AWS_*, AUTH_*, S3_BUCKET_NAME, NVIDIA_API_KEY, *_URL
#   .env.production.local  PayU keys, SMTP (order emails), receipts, store-board
#
# WHY THIS EXISTS: deploy.yml used to hand-maintain an inline list of env vars
# in its `pm2 start` command. That list only covered .env.production and
# silently dropped everything in .env.production.local — which took online
# payments (PayU) and order emails down on 2026-07-03 (the process simply had
# no PAYU_KEY/PAYU_SALT). Sourcing the files here is self-healing: any var added
# to either file is picked up automatically, no deploy.yml edit needed.
#
# Values in these files are UNQUOTED and may contain spaces or shell
# metacharacters, e.g. `SMTP_FROM=Farmyzest <info@farmyzest.com>`.
# So we read each line and split on the FIRST `=` — do NOT `source`/`.` these
# files (bash would try to interpret the `<` as a redirect and abort).
set -euo pipefail

DIR="/home/ec2-user/farmyzest"
cd "$DIR/app"

set -a
for f in "$DIR/.env.production" "$DIR/.env.production.local"; do
  [ -f "$f" ] || { echo "FATAL: missing env file $f" >&2; exit 1; }
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac   # skip blanks + comments
    [ "${line%%=*}" = "$line" ] && continue     # skip lines without '='
    export "${line%%=*}=${line#*=}"
  done < "$f"
done
set +a

# Fixed for this box; not carried in the env files.
export PORT=3000 HOSTNAME=0.0.0.0

# The launch command differs from the old `npm start`, so delete + start
# (not restart). pm2 save persists the process list across reboots.
pm2 delete farmyzest >/dev/null 2>&1 || true
pm2 start server.js --name farmyzest --update-env
pm2 save
