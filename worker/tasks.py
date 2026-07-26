"""Background tasks: analyze (transcribir + detectar highlights) y generate (renderizar Shorts)."""

import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import llm, pipeline, push, storage, transcribe_cloud, youtube_subs
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
        # ── Fast path: YouTube auto-captions ──────────────────────────
        # Si es un vídeo de YouTube con auto-captions ÚTILES (no música
        # pura), saltamos Whisper. 100x más rápido (~5s vs varios min).
        # Si las captions son basura (mayoría [música]), caemos a Whisper.
        transcript = None
        source = None
        if youtube_subs.is_youtube_url(url):
            storage.update_job(db, job_id, status="running", stage="youtube_captions", progress=0.05)
            yt_transcript = youtube_subs.try_youtube_captions(url)
            if yt_transcript and youtube_subs.captions_look_useful(yt_transcript):
                transcript = yt_transcript
            # Si no útiles, transcript sigue None → caeremos al bloque else

        if transcript is not None:
            # Con captions ya hechas, aún necesitamos el source path para el
            # generate posterior. Lo descargamos igual, pero el usuario ya
            # tiene los highlights: no bloquea el analyze.
            storage.update_job(db, job_id, stage="download", progress=0.4)
            source = pipeline.download_source(url, _sources_dir(), job_id)
            duration = pipeline.probe_duration(source)
            if duration > settings.max_input_duration_seconds:
                raise ValueError(
                    f"Vídeo demasiado largo ({int(duration)}s). Máximo permitido: "
                    f"{settings.max_input_duration_seconds}s."
                )
        else:
            # ── Fallback: descargar vídeo + (Groq | Whisper local) ──
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

            # 1er intento: Groq (cloud, gratis, ~20x más rápido que Whisper
            # local y mejor calidad, sobre todo para música/lyrics).
            if transcribe_cloud.is_available():
                storage.update_job(db, job_id, stage="transcribe_groq", progress=0.25)
                transcript = transcribe_cloud.transcribe_with_groq(audio)

            # Fallback: Whisper local si Groq no está configurado o falló.
            if transcript is None:
                storage.update_job(db, job_id, stage="transcribe", progress=0.25)
                transcript = pipeline.transcribe(audio)

        # Rechazo temprano si el audio tiene demasiado poco diálogo para
        # generar Shorts con sentido (música, silencio, efectos).
        segments = transcript["segments"]
        total_chars = sum(len(s.get("text", "")) for s in segments)
        if not segments or total_chars < 200:
            raise RuntimeError(
                "Este vídeo tiene muy poco diálogo hablado para generar Shorts "
                f"(solo {total_chars} caracteres transcritos en {int(duration)}s). "
                "Prueba con un vídeo con más contenido hablado (podcast, tutorial, "
                "entrevista, charla)."
            )

        storage.update_job(db, job_id, stage="highlights", progress=0.75)
        highlights = llm.find_highlights(
            segments, n=settings.max_highlights_per_job
        )
        if not highlights:
            raise RuntimeError(
                "La IA no encontró momentos con potencial viral en este vídeo. "
                "Prueba con contenido más punchy: entrevistas, opiniones fuertes, "
                "datos concretos, historias personales."
            )

        result = {
            "source_path": str(source),
            "duration": duration,
            "language": transcript["language"],
            "transcript_segments": transcript["segments"],
            "highlights": highlights,
        }
        storage.update_job(db, job_id, status="done", stage="ready", progress=1.0, result=result)
        push.notify_job(
            job_id,
            title="Análisis listo",
            body=f"Se detectaron {len(highlights)} momentos con potencial viral. Vuelve a la app para elegir.",
            url=f"/shorts?job={job_id}",
        )
    except Exception as e:
        storage.update_job(
            db, job_id, status="error", error=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}"
        )
        push.notify_job(job_id, title="El análisis falló", body="Toca para ver el detalle.", url="/shorts")


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
    highlight_indices: list[int] = inp.get("highlight_indices") or []
    custom_ranges: list[dict] = inp.get("custom_ranges") or []
    # Duración objetivo por Short. None = usar el rango completo del highlight/custom.
    clip_duration: float | None = inp.get("clip_duration")
    style: str = inp["style"]                 # 'original' | 'blur' | 'loop' | 'gradient'
    # voice_mode: 'ai' (edge-tts + reescribe) o 'original' (audio del vídeo).
    voice_mode: str = inp.get("voice_mode", "ai")
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

    # Lista unificada de {start, end, hook, tag} — auto highlights + custom.
    # Si clip_duration está fijo, cada rango se trunca a start + clip_duration.
    def _apply_duration(start: float, end: float) -> float:
        if clip_duration is None:
            return end
        return start + float(clip_duration)

    render_list: list[dict] = []
    for idx in highlight_indices:
        if 0 <= idx < len(all_highlights):
            h = all_highlights[idx]
            s = float(h["start"])
            e = _apply_duration(s, float(h["end"]))
            render_list.append({
                "start": s,
                "end": e,
                "hook": h.get("hook", ""),
                "tag": f"auto-{idx}",
            })
    for i, cr in enumerate(custom_ranges):
        start = float(cr["start"])
        raw_end = cr.get("end")
        if raw_end is None:
            # end no dado: usa clip_duration o default 30s
            end = start + (float(clip_duration) if clip_duration else 30.0)
        else:
            end = _apply_duration(start, float(raw_end))
        if end > start:
            render_list.append({
                "start": start,
                "end": end,
                "hook": cr.get("hook") or f"Personalizado {i + 1}",
                "tag": f"custom-{i}",
            })

    outputs: list[dict] = []
    total = len(render_list)

    try:
        storage.update_job(db, job_id, status="running", stage="starting", progress=0.02)

        for i, r in enumerate(render_list):
            n = i + 1
            base_progress = 0.05 + (i / max(total, 1)) * 0.90
            audio_mp3 = workdir / f"short-{n}-voice.mp3"
            ass_path = workdir / f"short-{n}.ass"
            script_text = ""
            start = r["start"]
            end = r["end"]

            if voice_mode == "original":
                storage.update_job(db, job_id, stage=f"short-{n}/audio-slice", progress=base_progress + 0.10)
                clip_dur = end - start
                pipeline.extract_audio_slice(source, start, clip_dur, audio_mp3)
                audio_dur = pipeline.probe_duration(audio_mp3)

                storage.update_job(db, job_id, stage=f"short-{n}/captions", progress=base_progress + 0.30)
                words = _extract_words(transcript_segments, start, end)
                build_ass(words, str(ass_path))
                script_text = _extract_text(transcript_segments, start, end)
            else:
                storage.update_job(db, job_id, stage=f"short-{n}/script", progress=base_progress)
                excerpt = _extract_text(transcript_segments, start, end)
                script_text = llm.rewrite_as_short_script(excerpt) if rewrite else excerpt

                storage.update_job(db, job_id, stage=f"short-{n}/tts", progress=base_progress + 0.10)
                pipeline.synthesize_tts(script_text, voice, rate, audio_mp3)
                audio_dur = pipeline.probe_duration(audio_mp3)

                storage.update_job(db, job_id, stage=f"short-{n}/captions", progress=base_progress + 0.30)
                tts_transcript = pipeline.transcribe(audio_mp3)
                words = [w for seg in tts_transcript["segments"] for w in seg["words"]]
                build_ass(words, str(ass_path))

            storage.update_job(db, job_id, stage=f"short-{n}/background", progress=base_progress + 0.50)
            bg_mp4 = workdir / f"short-{n}-bg.mp4"
            _build_bg(style, source, start, audio_dur, bg_mp4, loop_video_path)

            storage.update_job(db, job_id, stage=f"short-{n}/compose", progress=base_progress + 0.75)
            out_mp4 = outdir / f"{job_id}-short-{n}.mp4"
            pipeline.compose_final(
                bg_mp4, audio_mp3, ass_path, out_mp4,
                watermark_text=settings.watermark_text,
            )

            outputs.append({
                "index": i,   # posición en render_list (n-1)
                "tag": r["tag"],
                "file": str(out_mp4),
                "duration": audio_dur,
                "hook": r["hook"],
                "script": script_text,
                "voice_mode": voice_mode,
            })

        storage.update_job(
            db, job_id, status="done", stage="done", progress=1.0,
            result={"shorts": outputs, "style": style, "voice": voice, "voice_mode": voice_mode},
        )
        n = len(outputs)
        push.notify_job(
            job_id,
            title=f"{n} Reel{'s' if n != 1 else ''} listo{'s' if n != 1 else ''} para descargar",
            body="Toca para abrir y descargar.",
            url=f"/shorts?job={job_id}",
        )
    except Exception as e:
        storage.update_job(
            db, job_id, status="error",
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}",
        )
        push.notify_job(job_id, title="La generación falló", body="Toca para ver el detalle.", url="/shorts")


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


# ---------------------------------------------------------------------------
# Quick clip: modo "recorte manual" — sin analyze previo. Baja SOLO el tramo
# del vídeo pedido (para películas/series de 2h+) y genera el Short directo.
# ---------------------------------------------------------------------------
def run_quick_clip(job_id: str) -> None:
    db = settings.db_path
    job = storage.get_job(db, job_id)
    if job is None:
        return
    inp = job["input"]
    url: str = inp["url"]
    start: float = float(inp["start"])
    duration: float = float(inp["duration"])
    style: str = inp.get("style", "blur")
    voice_mode: str = inp.get("voice_mode", "original")
    voice: str = inp.get("voice") or settings.default_tts_voice
    rate: str = inp.get("rate") or settings.default_tts_rate
    hook: str = inp.get("hook") or "Clip manual"

    workdir = _work_dir(job_id)
    workdir.mkdir(parents=True, exist_ok=True)
    outdir = _output_dir()
    outdir.mkdir(parents=True, exist_ok=True)

    try:
        # 1) Descarga SOLO el tramo pedido (rápido, aunque el vídeo original dure 2h)
        storage.update_job(db, job_id, status="running", stage="download_section", progress=0.10)
        source = pipeline.download_section(url, start, duration, _sources_dir(), job_id)

        # 2) Extraer audio del slice (para transcripción)
        storage.update_job(db, job_id, stage="extract_audio", progress=0.30)
        audio = workdir / "clip.mp3"
        pipeline.extract_audio(source, audio)

        # 3) Transcribir (Groq si disponible, Whisper local fallback)
        storage.update_job(db, job_id, stage="transcribe", progress=0.45)
        transcript = None
        if transcribe_cloud.is_available():
            transcript = transcribe_cloud.transcribe_with_groq(audio)
        if transcript is None:
            transcript = pipeline.transcribe(audio)

        # 4) Captions .ass (words offset ya está a 0 porque el audio es solo el slice)
        storage.update_job(db, job_id, stage="captions", progress=0.60)
        words = [w for seg in transcript["segments"] for w in seg.get("words", [])]
        ass_path = workdir / "clip.ass"
        build_ass(words, str(ass_path))
        script_text = " ".join(s.get("text", "").strip() for s in transcript["segments"])

        # 5) Preparar audio del Short según voice_mode
        if voice_mode == "ai":
            # Reescribe con Claude + edge-tts
            script = llm.rewrite_as_short_script(script_text) if script_text else script_text
            voice_mp3 = workdir / "voice.mp3"
            pipeline.synthesize_tts(script, voice, rate, voice_mp3)
            audio_for_short = voice_mp3
            audio_dur = pipeline.probe_duration(voice_mp3)
            # Re-transcribir el TTS para captions sincronizadas
            tts_transcript = pipeline.transcribe(voice_mp3)
            words = [w for seg in tts_transcript["segments"] for w in seg.get("words", [])]
            build_ass(words, str(ass_path))
        else:
            audio_for_short = audio  # original
            audio_dur = pipeline.probe_duration(audio)

        # 6) Fondo visual
        storage.update_job(db, job_id, stage="background", progress=0.75)
        bg_mp4 = workdir / "bg.mp4"
        # start=0 porque el source ya empieza en el punto que queríamos
        _build_bg(style, source, 0.0, audio_dur, bg_mp4, None)

        # 7) Composición final
        storage.update_job(db, job_id, stage="compose", progress=0.90)
        out_mp4 = outdir / f"{job_id}-clip.mp4"
        pipeline.compose_final(
            bg_mp4, audio_for_short, ass_path, out_mp4,
            watermark_text=settings.watermark_text,
        )

        result = {
            "shorts": [{
                "index": 0,
                "tag": "quick",
                "file": str(out_mp4),
                "duration": audio_dur,
                "hook": hook,
                "script": script_text[:500] if script_text else "",
                "voice_mode": voice_mode,
            }],
            "style": style,
            "voice": voice,
            "voice_mode": voice_mode,
        }
        storage.update_job(db, job_id, status="done", stage="done", progress=1.0, result=result)
        push.notify_job(
            job_id,
            title="Tu Reel está listo",
            body=(hook or "Toca para abrir y descargar."),
            url=f"/shorts?job={job_id}",
        )
    except Exception as e:
        storage.update_job(
            db, job_id, status="error",
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-1500:]}",
        )
        push.notify_job(job_id, title="El recorte falló", body="Toca para ver el detalle.", url="/shorts")


def _extract_words(segments: list[dict], start: float, end: float) -> list[dict]:
    """Devuelve las palabras del transcript que caen en [start, end] con
    timestamps desplazados a 0 (el clip empieza en 0, no en start absoluto).
    Se usa en voice_mode='original' para construir captions sin re-transcribir.
    """
    out = []
    for s in segments:
        if s["end"] < start or s["start"] > end:
            continue
        for w in s.get("words") or []:
            w_start = float(w["start"])
            w_end = float(w["end"])
            if w_end < start or w_start > end:
                continue
            out.append({
                "word": w["word"],
                "start": max(0.0, w_start - start),
                "end": max(0.0, w_end - start),
            })
    return out
