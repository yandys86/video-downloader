"""Envío de Web Push Notifications a los suscriptores de un job."""

import json
import logging
from typing import Optional

from pywebpush import WebPushException, webpush

from . import storage
from .settings import settings

log = logging.getLogger("shorts-worker.push")


def is_configured() -> bool:
    return bool(settings.vapid_private_key and settings.vapid_public_key_b64url)


def notify_job(job_id: str, title: str, body: str, url: Optional[str] = None) -> int:
    """Envía notificación push a todos los suscriptores del job.
    Retorna cuántas se enviaron con éxito.
    """
    if not is_configured():
        return 0

    subs = storage.get_subscriptions_for_job(settings.db_path, job_id)
    if not subs:
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/shorts",
        "job_id": job_id,
    })
    vapid_claims = {"sub": settings.vapid_subject}

    ok = 0
    for raw in subs:
        try:
            sub = json.loads(raw)
        except json.JSONDecodeError:
            continue
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims=dict(vapid_claims),   # copia porque webpush muta el dict
                ttl=3600,
            )
            ok += 1
        except WebPushException as e:
            # 404/410 = subscription revocada, borrar de la DB
            code = getattr(getattr(e, "response", None), "status_code", None)
            if code in (404, 410):
                endpoint = sub.get("endpoint", "")
                if endpoint:
                    storage.delete_push_subscription(settings.db_path, endpoint)
            log.warning("push falló para %s: %s", sub.get("endpoint", "?")[:60], e)
        except Exception as e:  # pragma: no cover
            log.exception("push inesperado: %s", e)
    return ok
