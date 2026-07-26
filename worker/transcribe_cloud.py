"""Transcripción cloud vía Groq (compatible con la API OpenAI Whisper).

Modelo: whisper-large-v3-turbo — mejor calidad que Whisper base local y
que las auto-captions de YouTube para música/reggaeton. Muy rápido
(~10-20s para 60 min de audio). Free tier de Groq: 4000 min/día.
"""

from pathlib import Path
from typing import Optional

import httpx

from .settings import settings


GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
# Groq admite hasta 40MB por request para whisper. Audio MP3 a 96kbps ≈
# 750KB/min, entonces ~53 min de audio. Suficiente para casi todo.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024   # margen para no acercarnos al límite


def is_available() -> bool:
    return bool(settings.groq_api_key)


def transcribe_with_groq(
    audio_path: Path,
    language: Optional[str] = None,
    timeout: float = 180.0,
) -> Optional[dict]:
    """Transcribe con Groq. Devuelve {segments, language} al mismo shape
    que pipeline.transcribe() o None si no hay API key / falla.

    Groq devuelve segments + word-level timestamps si pedimos
    timestamp_granularities=word — lo usamos directamente para captions
    karaoke.
    """
    if not settings.groq_api_key:
        return None

    size = audio_path.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        # Audio demasiado grande; que el caller haga fallback a Whisper local
        return None

    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    data = {
        "model": settings.groq_model,
        "response_format": "verbose_json",
        "timestamp_granularities[]": "word",
    }
    if language:
        data["language"] = language

    try:
        with open(audio_path, "rb") as f:
            files = {"file": (audio_path.name, f, "audio/mpeg")}
            resp = httpx.post(
                GROQ_URL, headers=headers, data=data, files=files, timeout=timeout
            )
    except (httpx.HTTPError, OSError):
        return None

    if resp.status_code != 200:
        return None

    try:
        body = resp.json()
    except ValueError:
        return None

    return _groq_to_transcript(body)


def _groq_to_transcript(body: dict) -> dict:
    """Convierte respuesta verbose_json de Groq al shape de pipeline.transcribe."""
    words_all = body.get("words") or []
    segments_in = body.get("segments") or []
    lang = body.get("language") or "es"

    if not segments_in and not words_all:
        # Solo devolvió texto plano; construimos un único segmento sin words
        text = body.get("text", "").strip()
        if not text:
            return {"segments": [], "language": lang}
        return {
            "segments": [{"start": 0.0, "end": 0.0, "text": text, "words": []}],
            "language": lang,
        }

    # Si no vinieron segments pero sí words, agrupar words por ventanas de ~5s
    if not segments_in and words_all:
        return {
            "segments": _group_words_into_segments(words_all),
            "language": lang,
        }

    # Caso normal: hay segments; asignar words a cada segment por rango.
    out_segments = []
    for seg in segments_in:
        s_start = float(seg.get("start", 0.0))
        s_end = float(seg.get("end", s_start))
        s_text = (seg.get("text") or "").strip()
        seg_words = []
        for w in words_all:
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", w_start + 0.2))
            if w_end < s_start or w_start > s_end:
                continue
            seg_words.append({"word": w.get("word", ""), "start": w_start, "end": w_end})
        out_segments.append({
            "start": s_start,
            "end": s_end,
            "text": s_text,
            "words": seg_words,
        })
    return {"segments": out_segments, "language": lang}


def _group_words_into_segments(words: list[dict], window: float = 5.0) -> list[dict]:
    """Agrupa words en pseudo-segments de ~window segundos."""
    if not words:
        return []
    segments = []
    current: list[dict] = []
    seg_start = float(words[0].get("start", 0.0))
    for w in words:
        w_start = float(w.get("start", 0.0))
        w_end = float(w.get("end", w_start + 0.2))
        if w_end - seg_start > window and current:
            segments.append(_close_segment(current))
            current = []
            seg_start = w_start
        current.append({"word": w.get("word", ""), "start": w_start, "end": w_end})
    if current:
        segments.append(_close_segment(current))
    return segments


def _close_segment(words: list[dict]) -> dict:
    text = "".join(w["word"] for w in words).strip()
    return {
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": text,
        "words": words,
    }
