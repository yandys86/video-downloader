"""Subida de Shorts a YouTube con fecha de publicación.

Este proyecto no sabía subir a YouTube: solo generaba el MP4 y lo devolvía.
Lo que hay aquí es la parte imprescindible, portada del pipeline de
trading-book-videos, que ya llevaba meses subiendo a diario.

AUTORIZACIÓN (una vez por canal, hace falta navegador):

    python -m worker.youtube_up --authorize

El CT es headless, así que el flujo se corre desde un equipo con navegador y
el token resultante se copia al servidor. El token no caduca mientras la
pantalla de consentimiento de Google esté "En producción"; en modo "Testing"
caduca cada 7 días.
"""
from __future__ import annotations

import logging
import ssl
import time
from datetime import datetime, timedelta, timezone
from http.client import IncompleteRead, RemoteDisconnected
from pathlib import Path
from zoneinfo import ZoneInfo

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from .settings import settings

log = logging.getLogger("youtube_up")

# force-ssl y no solo `upload`: hace falta para poner miniatura y para leer de
# vuelta el estado del vídeo, que es como se comprueba que quedó programado.
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]

SUBIDA_REINTENTOS = 5
# ssl.SSLError y ConnectionError ya son OSError; se nombran para que se vea qué
# se cubre. Sin esto, un "EOF occurred in violation of protocol" —que es de la
# capa SSL y NO un HttpError— mata la subida entera con una línea de log. En el
# otro proyecto costó 2 Shorts de cada 4.
TRANSITORIOS = (ssl.SSLError, ConnectionError, TimeoutError,
                IncompleteRead, RemoteDisconnected, OSError)


def _paths() -> tuple[Path, Path]:
    base = Path(settings.workspace_dir) / "youtube"
    return (Path(settings.youtube_client_secrets or base / "client_secrets.json"),
            Path(settings.youtube_token_file or base / "token.json"))


def credenciales(interactivo: bool = False) -> Credentials:
    secrets, token = _paths()
    creds = None
    if token.exists():
        creds = Credentials.from_authorized_user_file(str(token), SCOPES)
    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        log.info("refrescando access_token")
        creds.refresh(Request())
    elif interactivo:
        if not secrets.exists():
            raise RuntimeError(f"falta {secrets} (client_secrets de Google Cloud)")
        flow = InstalledAppFlow.from_client_secrets_file(str(secrets), SCOPES)
        # run_local_server genera su propio `state`; pedirle la URL aparte con
        # authorization_url() crea un segundo state y el intercambio falla con
        # MismatchingStateError. Se deja que imprima él la suya.
        creds = flow.run_local_server(port=0)
    else:
        raise RuntimeError(
            f"sin credenciales en {token}. Corre: "
            f"python -m worker.youtube_up --authorize")

    token.parent.mkdir(parents=True, exist_ok=True)
    token.write_text(creds.to_json())
    token.chmod(0o600)
    log.info("token guardado en %s", token)
    return creds


def servicio(interactivo: bool = False):
    return build("youtube", "v3", credentials=credenciales(interactivo),
                 cache_discovery=False)


def canal_actual() -> dict:
    """A qué canal se va a subir. Se enseña antes de publicar nada: subir al
    canal equivocado es de las pocas cosas que no se pueden deshacer bien."""
    r = servicio().channels().list(part="snippet,statistics", mine=True).execute()
    it = r["items"][0]
    return {"id": it["id"],
            "titulo": it["snippet"]["title"],
            "handle": it["snippet"].get("customUrl", ""),
            "subs": it["statistics"].get("subscriberCount", "?")}


def subir(mp4: Path, titulo: str, descripcion: str, tags: list[str],
          publicar_en: datetime | None = None,
          categoria: str = "22") -> str:
    """Sube el MP4 y devuelve el video_id.

    `publicar_en` en UTC. Con fecha el vídeo va como `private` y YouTube lo
    hace público solo al llegar la hora; sin fecha sale público ya.
    """
    estado: dict = {"selfDeclaredMadeForKids": False}
    if publicar_en:
        estado["privacyStatus"] = "private"
        estado["publishAt"] = publicar_en.astimezone(timezone.utc) \
            .strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        estado["privacyStatus"] = "public"

    cuerpo = {
        "snippet": {"title": titulo[:100],
                    "description": descripcion[:4900],
                    "tags": [t.lstrip("#")[:30] for t in tags][:15],
                    "categoryId": categoria},
        "status": estado,
    }

    media = MediaFileUpload(str(mp4), chunksize=4 * 1024 * 1024,
                            resumable=True, mimetype="video/mp4")
    req = servicio().videos().insert(part="snippet,status", body=cuerpo,
                                     media_body=media)
    respuesta, intentos, ultimo = None, 0, 0
    while respuesta is None:
        try:
            estado_subida, respuesta = req.next_chunk()
            if estado_subida:
                pct = int(estado_subida.progress() * 100)
                if pct - ultimo >= 20:
                    log.info("  ↑ %d%%", pct)
                    ultimo = pct
            intentos = 0            # un trozo bueno limpia la cuenta
        except HttpError as e:
            if e.resp.status not in (500, 502, 503, 504):
                raise
            intentos += 1
            if intentos > SUBIDA_REINTENTOS:
                raise
            time.sleep(2 ** intentos)
            log.warning("HTTP %s, reintento %d/%d", e.resp.status,
                        intentos, SUBIDA_REINTENTOS)
        except TRANSITORIOS as e:
            # La subida es resumable: volver a llamar retoma donde se cortó.
            intentos += 1
            if intentos > SUBIDA_REINTENTOS:
                raise
            time.sleep(2 ** intentos)
            log.warning("corte de red (%s), reintento %d/%d",
                        type(e).__name__, intentos, SUBIDA_REINTENTOS)

    vid = respuesta["id"]
    log.info("✓ subido: https://youtu.be/%s", vid)
    return vid


def leer_estado(video_ids: list[str]) -> list[dict]:
    """Relee los vídeos para comprobar cómo quedaron de verdad.

    OJO: la API es de consistencia diferida. Leyendo justo después de subir o
    de reprogramar devuelve el valor ANTERIOR, y eso parece un fallo cuando no
    lo es. Dale ~20 s antes de creerte lo que diga.
    """
    r = servicio().videos().list(part="snippet,status",
                                 id=",".join(video_ids)).execute()
    return [{"id": it["id"],
             "titulo": it["snippet"]["title"],
             "privacidad": it["status"]["privacyStatus"],
             "publica_en": it["status"].get("publishAt")}
            for it in r["items"]]


def horas_de_publicacion(n: int, cada_horas: int = 12,
                         margen_horas: int = 2) -> list[datetime]:
    """`n` fechas UTC separadas `cada_horas`, empezando en el próximo hueco.

    Los huecos son las 08:00 y las 20:00 locales, que reparten el día en dos.
    La primera es la siguiente que deje al menos `margen_horas` por delante:
    programar para dentro de diez minutos no da tiempo a que YouTube procese
    el vídeo y sale con calidad baja.
    """
    tz = ZoneInfo(settings.tz_publicacion)
    ahora = datetime.now(tz)
    limite = ahora + timedelta(hours=margen_horas)

    hueco = ahora.replace(minute=0, second=0, microsecond=0)
    while hueco.hour not in (8, 20) or hueco <= limite:
        hueco += timedelta(hours=1)

    return [(hueco + timedelta(hours=cada_horas * i)).astimezone(timezone.utc)
            for i in range(n)]


def _cli() -> None:
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--authorize", action="store_true")
    p.add_argument("--whoami", action="store_true",
                   help="a qué canal apunta el token actual")
    a = p.parse_args()

    if a.authorize:
        credenciales(interactivo=True)
        print("\n✓ autorizado")
    c = canal_actual()
    print(f"\nCanal: {c['titulo']}  {c['handle']}")
    print(f"  id   : {c['id']}")
    print(f"  subs : {c['subs']}")


if __name__ == "__main__":
    _cli()
