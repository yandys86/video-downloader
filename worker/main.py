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


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)
    client_ip: str = ""


class GenerateRequest(BaseModel):
    parent_id: str
    highlight_indices: list[int] = Field(..., min_length=1, max_length=10)
    style: str = Field(..., pattern=r"^(original|blur|loop|gradient)$")
    # 'ai' = edge-tts + guion reescrito. 'original' = audio real del vídeo
    # (más rápido, útil para clips virales tal-cual del vídeo original).
    voice_mode: str = Field("ai", pattern=r"^(ai|original)$")
    voice: str | None = None
    rate: str | None = None
    loop_video_path: str | None = None
    rewrite: bool = True
    client_ip: str = ""


class JobRef(BaseModel):
    job_id: str


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.post("/analyze", response_model=JobRef, dependencies=[Depends(require_secret)])
def analyze(req: AnalyzeRequest, request: Request) -> JobRef:
    ip = req.client_ip or (request.client.host if request.client else "")
    # Rate limit: si el mismo IP tiene demasiados 'generate' recientes, bloquea
    # también el analyze (evita malgastar CPU en transcripciones sin propósito).
    if storage.count_jobs_by_ip_last_24h(settings.db_path, ip) >= 3:
        raise HTTPException(429, "Has alcanzado el límite diario de Shorts (3/día).")
    job_id = storage.new_job(settings.db_path, "analyze", {"url": req.url}, client_ip=ip)
    tasks.submit(tasks.run_analyze, job_id)
    return JobRef(job_id=job_id)


@app.post("/generate", response_model=JobRef, dependencies=[Depends(require_secret)])
def generate(req: GenerateRequest, request: Request) -> JobRef:
    ip = req.client_ip or (request.client.host if request.client else "")
    if storage.count_jobs_by_ip_last_24h(settings.db_path, ip) >= 3:
        raise HTTPException(429, "Has alcanzado el límite diario de Shorts (3/día).")
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
    if not job or job["status"] != "done" or job["kind"] != "generate":
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
