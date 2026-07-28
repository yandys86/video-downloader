"""
Envío de MP4s terminados al usuario vía Telegram Bot API.

Límite de sendVideo: ~50 MiB por el bot API pública. Si el fichero excede
`telegram_max_video_bytes` mandamos solo un mensaje con el enlace a la
descarga (que ya está expuesta por la app Next.js en /shorts/output/...).
"""

from __future__ import annotations

import logging
from pathlib import Path

import httpx

from .settings import settings

log = logging.getLogger("worker.telegram")

API_BASE = "https://api.telegram.org"


def is_configured() -> bool:
    return bool(settings.telegram_bot_token)


def _api(method: str) -> str:
    return f"{API_BASE}/bot{settings.telegram_bot_token}/{method}"


def send_message(chat_id: str, text: str) -> bool:
    if not is_configured():
        return False
    try:
        r = httpx.post(
            _api("sendMessage"),
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False,
            },
            timeout=15.0,
        )
        if not r.is_success:
            log.warning("telegram sendMessage %s: %s", r.status_code, r.text[:200])
        return r.is_success
    except Exception as e:
        log.warning("telegram sendMessage error: %s", e)
        return False


def send_video(
    chat_id: str,
    file_path: Path,
    caption: str,
    fallback_url: str | None = None,
) -> bool:
    """
    Envía el MP4 como video de Telegram. Si excede el límite del bot API,
    envía un mensaje con el enlace de descarga en su lugar.
    """
    if not is_configured():
        return False
    if not file_path.exists():
        log.warning("telegram send_video: file missing %s", file_path)
        return False

    size = file_path.stat().st_size
    if size > settings.telegram_max_video_bytes:
        msg = (
            f"{caption}\n\n"
            f"⚠️ El vídeo pesa {size / (1024*1024):.1f} MB — supera el límite de Telegram. "
            "Descárgalo desde la web:"
        )
        if fallback_url:
            msg += f"\n\n{fallback_url}"
        return send_message(chat_id, msg)

    try:
        with file_path.open("rb") as fh:
            files = {"video": (file_path.name, fh, "video/mp4")}
            data = {
                "chat_id": chat_id,
                "caption": caption,
                "parse_mode": "HTML",
                "supports_streaming": "true",
            }
            r = httpx.post(_api("sendVideo"), data=data, files=files, timeout=120.0)
        if not r.is_success:
            log.warning("telegram sendVideo %s: %s", r.status_code, r.text[:200])
            # Fallback a mensaje con enlace si falla el upload
            if fallback_url:
                return send_message(chat_id, f"{caption}\n\n{fallback_url}")
            return False
        return True
    except Exception as e:
        log.warning("telegram sendVideo error: %s", e)
        if fallback_url:
            return send_message(chat_id, f"{caption}\n\n{fallback_url}")
        return False


def notify_job_done(
    chat_id: str,
    job_id: str,
    file_path: Path,
    label: str = "Tu Reel está listo",
) -> None:
    """Wrapper para llamar desde tasks al terminar un job."""
    base = settings.telegram_public_base_url.rstrip("/")
    fallback = f"{base}/shorts/output/{job_id}/{file_path.name}"
    caption = f"🎬 <b>{label}</b>\n<code>{file_path.name}</code>"
    send_video(chat_id, file_path, caption, fallback_url=fallback)
