"""
Envío del MP4 terminado al email del usuario vía Resend HTTP API.

Attachment inline si <9 MB (límite Resend ~10 MB total). Si excede,
se envía solo el enlace de descarga.
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path

import httpx

from .settings import settings

log = logging.getLogger("worker.email")

API_URL = "https://api.resend.com/emails"


def is_configured() -> bool:
    return bool(settings.resend_api_key and settings.email_from)


def _download_url(job_id: str, filename: str) -> str:
    base = settings.email_public_base_url.rstrip("/")
    return f"{base}/shorts/output/{job_id}/{filename}"


def _html_body(hook: str, url: str, filename: str, attached: bool) -> str:
    intro = "Aquí lo tienes adjunto." if attached else "Puedes descargarlo desde este enlace:"
    return f"""
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto">
      <h2 style="margin:0 0 8px">🎬 {hook or 'Tu Reel está listo'}</h2>
      <p style="color:#555">{intro}</p>
      <p><a href="{url}" style="display:inline-block;background:#d946ef;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Ver / descargar</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Archivo: <code>{filename}</code><br>
        Puedes desactivar estos avisos en <a href="{settings.email_public_base_url}/account">tu cuenta</a>.
      </p>
    </div>
    """


def send_reel_ready(to: str, hook: str, job_id: str, file_path: Path) -> bool:
    if not is_configured():
        return False
    if not file_path.exists():
        log.warning("email send_reel_ready: file missing %s", file_path)
        return False

    filename = file_path.name
    size = file_path.stat().st_size
    url = _download_url(job_id, filename)
    attached = size <= settings.email_max_attachment_bytes

    payload: dict = {
        "from": settings.email_from,
        "to": to,
        "subject": f"🎬 {hook or 'Tu Reel está listo'}",
        "html": _html_body(hook, url, filename, attached),
        "text": f"{hook or 'Tu Reel está listo'}\n\nDescarga: {url}",
    }

    if attached:
        try:
            data = base64.b64encode(file_path.read_bytes()).decode("ascii")
            payload["attachments"] = [
                {"filename": filename, "content": data, "content_type": "video/mp4"},
            ]
        except Exception as e:
            log.warning("email attachment read fail: %s — enviando solo link", e)

    try:
        r = httpx.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        if not r.is_success:
            log.warning("resend send %s: %s", r.status_code, r.text[:300])
        return r.is_success
    except Exception as e:
        log.warning("resend send error: %s", e)
        return False
