#!/usr/bin/env bash
# deploy-worker.sh — Actualiza el shorts-worker en el CT 222.
# Se ejecuta DENTRO del CT como root.
#
# Uso:
#   ssh root@<IP-CT-222> bash /opt/shorts-worker/scripts/deploy-worker.sh
#
set -euo pipefail

INSTALL_DIR="/opt/shorts-worker"
SERVICE="shorts-worker.service"
SERVICE_USER="shorts"

log() { printf '\033[1;34m▶\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

cd "$INSTALL_DIR"

log "git pull…"
sudo -u "$SERVICE_USER" git pull --rebase

# Si requirements.txt cambió, reinstalamos.
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q '^worker/requirements\.txt$'; then
  log "requirements.txt cambió → reinstalando Python deps"
  sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && .venv/bin/pip install -r worker/requirements.txt"
fi

# Si el systemd unit cambió, reinstálalo.
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q '^worker/systemd/shorts-worker\.service$'; then
  log "systemd unit cambió → reinstalando"
  install -m 644 "$INSTALL_DIR/worker/systemd/shorts-worker.service" \
    /etc/systemd/system/shorts-worker.service
  systemctl daemon-reload
fi

log "Reiniciando $SERVICE…"
systemctl restart "$SERVICE"
sleep 2
if ! systemctl is-active --quiet "$SERVICE"; then
  err "El service no arrancó"
  systemctl status "$SERVICE" --no-pager | head -25
  exit 1
fi

log "OK — worker corriendo"
