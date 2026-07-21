# Shorts Worker

Backend FastAPI que genera vídeos Short (9:16) desde vídeos largos de YouTube.

Se despliega en un LXC Proxmox aparte (CT 222) y es consumido por el Next.js de tuvideodown.com a través de HTTP interno con un secreto compartido.

## Pipeline

1. `yt-dlp` descarga el vídeo largo
2. `faster-whisper` transcribe con timestamps de palabra
3. Claude API detecta los top-N highlights viral-worthy
4. Claude API reescribe cada highlight como guion punchy de Short
5. `edge-tts` sintetiza voz IA neural en español (gratis)
6. Se re-transcribe el audio TTS para captions palabra por palabra
7. `ffmpeg` compone MP4 1080×1920 con fondo elegido + captions .ass karaoke

## Estilos de fondo

- `original` — recorte del vídeo largo a 9:16
- `blur` — vídeo original centrado sobre versión blureada de sí mismo (siempre queda bien, sin deps externas)
- `loop` — vídeo en bucle (gameplay/satisfying) que el user provee vía path
- `gradient` — gradiente animado, captions protagonistas

## Endpoints

Todos requieren header `X-Worker-Secret: <valor de WORKER_SECRET>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/healthz` | ping |
| POST | `/analyze` | descarga + transcribe + detecta highlights |
| POST | `/generate` | renderiza uno o varios Shorts a partir de highlights elegidos |
| GET  | `/jobs/{id}` | estado + resultado del job |
| GET  | `/download/{job_id}/{idx}` | descarga MP4 del Short generado |

## Desarrollo local (macOS)

```bash
brew install ffmpeg yt-dlp
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
cp .env.example .env  # y edita
uvicorn worker.main:app --reload --port 8000
```

## Deploy en LXC 222

Ver `../scripts/setup-lxc-222.sh` (provisioning) y `../scripts/deploy-worker.sh` (updates).

## Rate limiting

Máximo 3 jobs `generate` por IP cada 24 horas. Configurable en `worker/main.py`.

## Estado

MVP funcional. Ideas para v2:
- Detección facial para recentrado inteligente del recorte
- Integración Pexels API para B-roll relevante
- Música de fondo automática (biblioteca local o API)
- Multi-idioma (whisper multi + edge-tts multi)
- WebSocket para progreso en tiempo real (en vez de polling)
