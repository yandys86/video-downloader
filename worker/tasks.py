"""Background tasks: analyze (transcribir + detectar highlights) y generate (renderizar Shorts)."""

import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import llm, pipeline, storage
from .captions import build_ass
from .settings import settings


log = logging.getLogger("shorts-worker.tasks")

executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_jobs)


def _sources_dir() -> Path:
    return Path(settings.workspace_dir) / "sources"


def _work_dir(job_id: str) -> Path:
    return Path(settings.workspace_dir) / "jobs" / job_id


def _output_dir() -> Path:
    return Path(settings.workspace_dir) / "output"


def submit(fn, *args) -> None:
    executor.submit(_safe, fn, *args)


def _safe(fn, *args) -> None:
    try:
        fn(*args)
    except Exception as e:  # pragma: no cover
        log.exception("Task failed: %s", e)


# ---------------------------------------------------------------------------
# Analyze: descarga → transcribe → highlights
# ---------------------------------------------------------------------------
def run_analyze(job_id: str) -> None:
    db = settings.db_path
    job = storage.get_job(db, job_id)
    if job is None:
        return
    url = job["input"]["url"]

    try:
        storage.update_job(db, job_id, status="running", stage="download", progress=0.05)
        source = pipeline.download_source(url, _sources_dir(), job_id)

        duration = pipeline.probe_duration(source)
        if duration > settings.max_input_duration_seconds:
            raise ValueError(
                f"Vídeo demasiado largo ({int(duration)}s). Máximo permitido: "
                f"{settings.max_input_duration_seconds}s."
            )

        storage.update_job(db, job_id, stage="extract_audio", progress=0.15)
        audio = _work_dir(job_id) / "source.mp3"
        pipeline.extract_audio(source, audio)

        storage.update_job(db, job_id, stage="transcribe", progress=0.25)
        transcript = pipeline.transcribe(audio)

        storage.update_job(db, job_id, stage="highlights", progress=0.75)
        highlights = llm.find_highlights(
            transcript["segments"], n=settings.max_highlights_per_job
        )
        if not highlights:
            raise RuntimeError("No se detectaron highlights (transcript vacío o error LLM)")

        result = {
            "source_path": str(source),
            "duration": duration,
            "language": transcript["language"],
            "transcript_segments": transcript["segments"],
            "highlights": highlights,
        }
        storage.update_job(db, job_id, status="done", stage="ready", progress=1.0, result=result)
    except Exception as e:
        storage.update_job(
            db, job_id, status="error", error=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}"
        )


# ---------------------------------------------------------------------------
# Generate: reescribe → TTS → captions → fondo → compose  (por highlight)
# ---------------------------------------------------------------------------
def run_generate(job_id: str) -> None:
    db = settings.db_path
    job = storage.get_job(db, job_id)
    if job is None:
        return
    parent = storage.get_job(db, job["parent_id"]) if job.get("parent_id") else None
    if parent is None or not parent.get("result"):
        storage.update_job(db, job_id, status="error", error="parent job not found or not ready")
        return

    inp = job["input"]
    highlight_indices: list[int] = inp["highlight_indices"]
    style: str = inp["style"]                 # 'original' | 'blur' | 'loop' | 'gradient'
    voice: str = inp.get("voice") or settings.default_tts_voice
    rate: str = inp.get("rate") or settings.default_tts_rate
    loop_video_path: str | None = inp.get("loop_video_path")
    rewrite: bool = inp.get("rewrite", True)

    source = Path(parent["result"]["source_path"])
    all_highlights = parent["result"]["highlights"]
    transcript_segments = parent["result"]["transcript_segments"]
    workdir = _work_dir(job_id)
    workdir.mkdir(parents=True, exist_ok=True)
    outdir = _output_dir()
    outdir.mkdir(parents=True, exist_ok=True)

    outputs: list[dict] = []
    total = len(highlight_indices)

    try:
        storage.update_job(db, job_id, status="running", stage="starting", progress=0.02)

        for i, idx in enumerate(highlight_indices):
            if idx < 0 or idx >= len(all_highlights):
                continue
            h = all_highlights[idx]
            n = i + 1
            base_progress = 0.05 + (i / max(total, 1)) * 0.90

            storage.update_job(db, job_id, stage=f"short-{n}/script", progress=base_progress)
            excerpt = _extract_text(transcript_segments, h["start"], h["end"])
            script = llm.rewrite_as_short_script(excerpt) if rewrite else excerpt

            storage.update_job(db, job_id, stage=f"short-{n}/tts", progress=base_progress + 0.10)
            voice_mp3 = workdir / f"short-{n}-voice.mp3"
            pipeline.synthesize_tts(script, voice, rate, voice_mp3)
            voice_dur = pipeline.probe_duration(voice_mp3)

            storage.update_job(db, job_id, stage=f"short-{n}/captions", progress=base_progress + 0.30)
            tts_transcript = pipeline.transcribe(voice_mp3)
            words = [w for seg in tts_transcript["segments"] for w in seg["words"]]
            ass_path = workdir / f"short-{n}.ass"
            build_ass(words, str(ass_path))

            storage.update_job(db, job_id, stage=f"short-{n}/background", progress=base_progress + 0.50)
            bg_mp4 = workdir / f"short-{n}-bg.mp4"
            _build_bg(style, source, h["start"], voice_dur, bg_mp4, loop_video_path)

            storage.update_job(db, job_id, stage=f"short-{n}/compose", progress=base_progress + 0.75)
            out_mp4 = outdir / f"{job_id}-short-{n}.mp4"
            pipeline.compose_final(bg_mp4, voice_mp3, ass_path, out_mp4)

            outputs.append({
                "index": idx,
                "file": str(out_mp4),
                "duration": voice_dur,
                "hook": h.get("hook", ""),
                "script": script,
            })

        storage.update_job(
            db, job_id, status="done", stage="done", progress=1.0,
            result={"shorts": outputs, "style": style, "voice": voice},
        )
    except Exception as e:
        storage.update_job(
            db, job_id, status="error",
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}",
        )


def _build_bg(style: str, source: Path, start: float, duration: float, out_mp4: Path, loop: str | None) -> None:
    if style == "original":
        pipeline.build_background_original_crop(source, start, duration, out_mp4)
    elif style == "blur":
        pipeline.build_background_blur(source, start, duration, out_mp4)
    elif style == "loop":
        if not loop:
            raise ValueError("style=loop requiere loop_video_path")
        pipeline.build_background_loop(Path(loop), duration, out_mp4)
    elif style == "gradient":
        pipeline.build_background_gradient(duration, out_mp4)
    else:
        raise ValueError(f"style desconocido: {style}")


def _extract_text(segments: list[dict], start: float, end: float) -> str:
    parts = []
    for s in segments:
        if s["end"] < start or s["start"] > end:
            continue
        parts.append(s["text"].strip())
    return " ".join(parts).strip()
