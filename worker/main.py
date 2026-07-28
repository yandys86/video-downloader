"""FastAPI worker para generar Shorts. Se despliega en Proxmox CT 222."""

import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import storage, tasks
from .pipeline import ensure_tools
from .settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_tools()
    storage.init_db(settings.db_path)
    Path(settings.workspace_dir).mkdir(parents=True, exist_ok=True)
    # Marcar como error cualquier job que quedó "running" al arrancar:
    # implica que el worker se reinició durante el procesamiento y esos
    # threads ya no existen. Sin esto quedan huérfanos para siempre.
    orphans = storage.mark_orphaned_running_jobs(settings.db_path)
    if orphans:
        print(f"[startup] marked {orphans} orphaned running jobs as error")
    yield


app = FastAPI(title="Shorts Worker", version="0.1.0", lifespan=lifespan)


@app.exception_handler(sqlite3.OperationalError)
async def _sqlite_locked_handler(request: Request, exc: sqlite3.OperationalError):
    # "database is locked" es transitorio (contention). Devolvemos 503 con
    # Retry-After para que el cliente reintente en vez de mostrar 500 al usuario.
    if "locked" in str(exc).lower():
        return JSONResponse(
            {"detail": "worker temporalmente ocupado, reintenta"},
            status_code=503,
            headers={"Retry-After": "2"},
        )
    return JSONResponse({"detail": f"db error: {exc}"}, status_code=500)


def require_secret(x_worker_secret: Annotated[str | None, Header()] = None) -> None:
    if not x_worker_secret or x_worker_secret != settings.worker_secret:
        raise HTTPException(status_code=401, detail="invalid worker secret")


def _check_daily_limit(ip: str) -> None:
    """Rate limit configurable por env var. 0 = desactivado."""
    limit = settings.max_shorts_per_ip_per_day
    if limit <= 0:
        return
    used = storage.count_jobs_by_ip_last_24h(settings.db_path, ip)
    if used >= limit:
        raise HTTPException(
            429,
            f"Has alcanzado el límite diario de Shorts ({limit}/día).",
        )


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)
    client_ip: str = ""


class CustomRange(BaseModel):
    start: float = Field(..., ge=0)
    # end es opcional: si se omite, se usa start + clip_duration (o el default).
    end: float | None = Field(None, gt=0)
    hook: str = ""


class GenerateRequest(BaseModel):
    parent_id: str
    # Al menos uno de highlight_indices o custom_ranges debe tener elementos.
    highlight_indices: list[int] = Field(default_factory=list, max_length=10)
    custom_ranges: list[CustomRange] = Field(default_factory=list, max_length=10)
    # Duración objetivo del Short en segundos. None = usar el rango completo
    # del highlight/custom range (comportamiento auto).
    # Cuando se especifica, cada clip se recorta a [start, start+clip_duration].
    clip_duration: float | None = Field(None, gt=0, le=180)
    style: str = Field(..., pattern=r"^(original|blur|loop|gradient)$")
    # 'ai' = edge-tts + guion reescrito. 'original' = audio real del vídeo
    # (más rápido, útil para clips virales tal-cual del vídeo original).
    voice_mode: str = Field("ai", pattern=r"^(ai|original)$")
    voice: str | None = None
    rate: str | None = None
    loop_video_path: str | None = None
    rewrite: bool = True
    # Quemar subtítulos en el vídeo. False = Reel sin captions (mejor para
    # música / karaoke donde las auto-captions salen mal).
    captions: bool = True
    client_ip: str = ""
    # Si el usuario tiene Telegram vinculado, el proxy Next.js pasa aquí su
    # chat_id y el worker envía cada MP4 terminado al terminar el job.
    notify_telegram_chat_id: str | None = None
    # Email opt-in (User.emailNotifications=true). Vacío = no enviar.
    notify_email: str | None = None


class QuickClipRequest(BaseModel):
    """Recorte manual: baja SOLO un tramo del vídeo y genera un Short.
    Ideal para películas/series largas donde ya sabes qué momento quieres.

    Se puede especificar el rango como `start + duration` O como `start + end`.
    Si viene `end`, tiene prioridad sobre `duration`.
    """
    url: str = Field(..., min_length=8, max_length=2048)
    start: float = Field(..., ge=0)              # segundos desde el inicio del vídeo original
    end: float | None = Field(None, gt=0)         # opcional; si se da, ignora duration
    duration: float | None = Field(None, gt=1, le=300)   # fallback si no hay end
    style: str = Field("blur", pattern=r"^(original|blur|loop|gradient)$")
    voice_mode: str = Field("original", pattern=r"^(ai|original)$")
    voice: str | None = None
    rate: str | None = None
    hook: str = ""
    captions: bool = True
    client_ip: str = ""
    notify_telegram_chat_id: str | None = None
    notify_email: str | None = None


class JobRef(BaseModel):
    job_id: str


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.get("/push/public_key")
def push_public_key() -> dict:
    """Frontend lo pide para crear la subscripción Web Push."""
    return {"public_key": settings.vapid_public_key_b64url}


class PushSubscribeRequest(BaseModel):
    subscription: dict
    job_id: str | None = None
    client_ip: str = ""


@app.post("/push/subscribe", dependencies=[Depends(require_secret)])
def push_subscribe(req: PushSubscribeRequest, request: Request) -> dict:
    """Guarda la subscription Web Push del navegador y opcionalmente la
    asocia a un job_id concreto para que reciba notificación cuando termine.
    """
    import json as _json
    endpoint = req.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "subscription.endpoint requerido")
    ip = req.client_ip or (request.client.host if request.client else "")
    storage.save_push_subscription(
        settings.db_path,
        endpoint=endpoint,
        sub_json=_json.dumps(req.subscription),
        client_ip=ip,
        job_id=req.job_id,
    )
    return {"ok": True}


@app.post("/analyze", response_model=JobRef, dependencies=[Depends(require_secret)])
def analyze(req: AnalyzeRequest, request: Request) -> JobRef:
    ip = req.client_ip or (request.client.host if request.client else "")
    # Rate limit: si el mismo IP tiene demasiados 'generate' recientes, bloquea
    # también el analyze (evita malgastar CPU en transcripciones sin propósito).
    _check_daily_limit(ip)
    job_id = storage.new_job(settings.db_path, "analyze", {"url": req.url}, client_ip=ip)
    tasks.submit(tasks.run_analyze, job_id)
    return JobRef(job_id=job_id)


@app.post("/generate", response_model=JobRef, dependencies=[Depends(require_secret)])
def generate(req: GenerateRequest, request: Request) -> JobRef:
    ip = req.client_ip or (request.client.host if request.client else "")
    _check_daily_limit(ip)
    if not req.highlight_indices and not req.custom_ranges:
        raise HTTPException(400, "debes elegir al menos 1 highlight o rango personalizado")
    parent = storage.get_job(settings.db_path, req.parent_id)
    if not parent or parent["status"] != "done":
        raise HTTPException(400, "parent_id no existe o no está listo")
    job_id = storage.new_job(
        settings.db_path,
        "generate",
        req.model_dump(exclude_none=True, exclude={"client_ip"}),
        client_ip=ip,
        parent_id=req.parent_id,
    )
    tasks.submit(tasks.run_generate, job_id)
    return JobRef(job_id=job_id)


@app.post("/quick_clip", response_model=JobRef, dependencies=[Depends(require_secret)])
def quick_clip(req: QuickClipRequest, request: Request) -> JobRef:
    ip = req.client_ip or (request.client.host if request.client else "")
    _check_daily_limit(ip)
    # Determinar duración final: prioridad end > duration > default 30s
    if req.end is not None:
        if req.end <= req.start:
            raise HTTPException(400, "'end' debe ser mayor que 'start'")
        duration = req.end - req.start
    elif req.duration is not None:
        duration = req.duration
    else:
        raise HTTPException(400, "Debes especificar 'end' o 'duration'")
    if duration > 300:
        raise HTTPException(400, "Duración máxima del clip: 300 segundos (5 min)")

    payload = req.model_dump(exclude_none=True, exclude={"client_ip", "end", "duration"})
    payload["duration"] = duration  # normalizamos a 'duration' para tasks.py
    job_id = storage.new_job(
        settings.db_path,
        "quick_clip",
        payload,
        client_ip=ip,
    )
    tasks.submit(tasks.run_quick_clip, job_id)
    return JobRef(job_id=job_id)


@app.get("/jobs/{job_id}", dependencies=[Depends(require_secret)])
def get_job(job_id: str) -> dict:
    job = storage.get_job(settings.db_path, job_id)
    if not job:
        raise HTTPException(404, "job no encontrado")
    # No filtramos el result: lo usa el Next.js para pintar highlights/shorts.
    return job


@app.get("/download/{job_id}/{idx}", dependencies=[Depends(require_secret)])
def download(job_id: str, idx: int) -> FileResponse:
    job = storage.get_job(settings.db_path, job_id)
    if not job or job["status"] != "done" or job["kind"] not in ("generate", "quick_clip"):
        raise HTTPException(404, "short no disponible")
    shorts = (job.get("result") or {}).get("shorts") or []
    match = next((s for s in shorts if s["index"] == idx), None)
    if not match:
        raise HTTPException(404, "short index no encontrado")
    path = Path(match["file"])
    if not path.exists():
        raise HTTPException(410, "archivo caducado o borrado")
    return FileResponse(
        str(path),
        media_type="video/mp4",
        filename=f"short-{idx + 1}.mp4",
    )
