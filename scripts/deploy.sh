#!/usr/bin/env bash
# deploy.sh — Despliegue limpio de TuVideoDown en el server.
#
# Hace:
#   1. git pull --rebase
#   2. npm install (si hubo cambio en package-lock.json)
#   3. npm run build (Next.js)
#   4. systemctl restart video-downloader.service
#   5. (opcional) purga la caché de Cloudflare si .env.deploy está configurado,
#      para que los usuarios vean inmediatamente la versión nueva en vez del
#      HTML cacheado por la CDN.
#
# Setup de la purga (una sola vez):
#   1. En el dashboard de Cloudflare:
#      My Profile → API Tokens → Create Token → Custom token con:
#        Permissions: Zone | Cache Purge | Purge
#        Zone Resources: Include | Specific zone | tuvideodown.com
#   2. Coge el Zone ID de la página de overview del dominio.
#   3. En el server:
#        cat > /opt/video-downloader/.env.deploy <<EOF
#        CF_API_TOKEN=tu_token_aqui
#        CF_ZONE_ID=tu_zone_id_aqui
#        EOF
#        chmod 600 /opt/video-downloader/.env.deploy
#
# Uso:
#   sudo bash /opt/video-downloader/scripts/deploy.sh

set -euo pipefail

REPO_DIR="/opt/video-downloader"
SERVICE="video-downloader.service"
ENV_DEPLOY="$REPO_DIR/.env.deploy"

log() { printf '\033[1;34m▶\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

cd "$REPO_DIR"

log "Pulling latest from git…"
git pull --rebase

# Si package.json cambió o no hay node_modules, reinstalamos deps.
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -qE '^(package\.json|package-lock\.json)$' \
   || [[ ! -d node_modules ]]; then
  log "deps cambiaron → npm install"
  npm install
fi

# Prisma: aplicar migraciones/schema (idempotente).
if [[ -f prisma/schema.prisma ]]; then
  log "Prisma: sincronizando schema con la DB…"
  npx prisma db push --skip-generate --accept-data-loss=false || true
  npx prisma generate
fi

log "Building Next.js…"
npm run build

log "Restarting $SERVICE…"
systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || { err "El service no arrancó"; systemctl status "$SERVICE" --no-pager | head -20; exit 1; }

# Purga de Cloudflare (sólo si hay credenciales).
if [[ -f "$ENV_DEPLOY" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_DEPLOY"
fi

if [[ -n "${CF_API_TOKEN:-}" && -n "${CF_ZONE_ID:-}" ]]; then
  log "Purgando caché de Cloudflare…"
  RESPONSE=$(curl -sS -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  SUCCESS=$(echo "$RESPONSE" | grep -oE '"success":\s*(true|false)' | head -1 | grep -oE '(true|false)')
  if [[ "$SUCCESS" == "true" ]]; then
    log "Cache purged ✓"
  else
    err "Cloudflare devolvió error:"
    echo "$RESPONSE" | head -c 500
    echo
    exit 1
  fi
else
  log "Sin credenciales Cloudflare (.env.deploy ausente o vacío); salto la purga."
fi

log "Despliegue OK"
