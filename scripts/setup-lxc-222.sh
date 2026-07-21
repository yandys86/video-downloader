#!/usr/bin/env bash
# setup-lxc-222.sh — Provisiona desde cero el CT 222 en Proxmox para el
# shorts-worker. Se ejecuta DENTRO del contenedor (no en el host Proxmox).
#
# Uso:
#   1) En el host Proxmox (yiyolmb):
#      pct create 222 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
#        --hostname shorts-worker \
#        --cores 6 --memory 8192 --swap 2048 \
#        --rootfs local-lvm:40 \
#        --net0 name=eth0,bridge=vmbr0,ip=dhcp \
#        --features nesting=1 \
#        --unprivileged 1 \
#        --onboot 1 \
#        --start 1
#      # NUNCA añadir lxc.apparmor.profile: unconfined (rompe la creación de más LXCs).
#
#   2) Copiar tu clave SSH al root del CT (una vez):
#      pct enter 222
#        mkdir -p /root/.ssh && chmod 700 /root/.ssh
#        # pega tu clave pública en /root/.ssh/authorized_keys
#      exit
#
#   3) Desde tu Mac:
#      ssh root@<IP-CT-222> "bash -s" < scripts/setup-lxc-222.sh
#
set -euo pipefail

log() { printf '\033[1;34m▶\033[0m %s\n' "$*"; }

# El repo GitHub es privado/HTTPS o SSH según prefieras. Si vas por SSH,
# añade una deploy key en GitHub → Settings → Deploy keys y usa la ruta git@.
REPO_URL="${REPO_URL:-https://github.com/yandys86/video-downloader.git}"
INSTALL_DIR="/opt/shorts-worker"
DATA_DIR="/var/lib/shorts-worker"
SERVICE_USER="shorts"

log "Actualizando sistema…"
apt-get update -qq
apt-get upgrade -y -qq

log "Instalando dependencias del sistema…"
apt-get install -y -qq \
  git curl ca-certificates \
  python3.11 python3.11-venv python3-pip \
  ffmpeg \
  build-essential \
  libsndfile1

log "Instalando yt-dlp (versión al día desde pip)…"
pip3 install --break-system-packages -U yt-dlp

log "Creando usuario de servicio '$SERVICE_USER'…"
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --home-dir "$INSTALL_DIR" --shell /bin/bash "$SERVICE_USER"
fi

log "Creando directorios…"
mkdir -p "$INSTALL_DIR" "$DATA_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"

log "Clonando repo (si no existe)…"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  sudo -u "$SERVICE_USER" git clone "$REPO_URL" "$INSTALL_DIR"
else
  sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" pull --rebase
fi

log "Creando virtualenv y dependencias Python…"
sudo -u "$SERVICE_USER" bash -c "
  cd $INSTALL_DIR
  python3.11 -m venv .venv
  .venv/bin/pip install -U pip wheel
  .venv/bin/pip install -r worker/requirements.txt
"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  log "Creando $INSTALL_DIR/.env desde .env.example — EDITA los valores"
  cp "$INSTALL_DIR/worker/.env.example" "$INSTALL_DIR/.env"
  chmod 600 "$INSTALL_DIR/.env"
  chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
  echo "   → nano $INSTALL_DIR/.env  (rellenar ANTHROPIC_API_KEY y WORKER_SECRET)"
fi

log "Instalando unit systemd…"
install -m 644 "$INSTALL_DIR/worker/systemd/shorts-worker.service" \
  /etc/systemd/system/shorts-worker.service
systemctl daemon-reload
systemctl enable shorts-worker.service

log "Precalentando modelo Whisper (descarga inicial)…"
sudo -u "$SERVICE_USER" bash -c "
  cd $INSTALL_DIR
  .venv/bin/python -c 'from faster_whisper import WhisperModel; WhisperModel(\"small\", device=\"cpu\", compute_type=\"int8\")'
" || echo "  (falló el precalentado; el modelo se descargará en el primer request)"

log "Configuración inicial completada."
echo
echo "Siguientes pasos:"
echo "  1) nano $INSTALL_DIR/.env  → rellenar ANTHROPIC_API_KEY y WORKER_SECRET"
echo "  2) systemctl start shorts-worker"
echo "  3) systemctl status shorts-worker"
echo "  4) journalctl -u shorts-worker -f   (ver logs)"
echo "  5) curl -H 'X-Worker-Secret: <secret>' http://localhost:8000/healthz"
