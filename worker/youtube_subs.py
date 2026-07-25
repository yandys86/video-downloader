"""Descarga los subtítulos auto-generados de YouTube (formato JSON3) SIN
bajar el vídeo. 100x más rápido que Whisper para vídeos que los tienen.

YouTube emite subtítulos con timing a nivel de palabra en el formato JSON3.
Los convertimos al mismo shape que devuelve pipeline.transcribe() para que
el resto del pipeline (highlights + captions) siga funcionando sin cambios.
"""

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def is_youtube_url(url: str) -> bool:
    return bool(_YOUTUBE_ID_RE.search(url))


def try_youtube_captions(
    url: str,
    preferred_langs: tuple[str, ...] = ("es", "en"),
) -> Optional[dict]:
    """Intenta descargar auto-captions de YouTube en formato JSON3.

    Devuelve dict con la misma forma que pipeline.transcribe() o None si
    el vídeo no tiene captions o no es YouTube:
        {"segments": [...], "language": "es"}

    Rápido (~3-8s típicamente): solo metadata + subtítulos, NO baja el vídeo.

    Intenta cada idioma preferido POR SEPARADO para tolerar rate-limits
    parciales (si el primero da 429, el siguiente puede funcionar).
    """
    if not is_youtube_url(url):
        return None

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        picked = None
        for lang in preferred_langs:
            cmd = [
                "yt-dlp",
                "--skip-download",
                "--write-auto-sub",
                "--write-sub",
                "--sub-langs", lang,
                "--sub-format", "json3",
                "-o", str(tmp_path / f"sub_{lang}.%(ext)s"),
                url,
            ]
            try:
                # check=False: yt-dlp puede exit 1 aunque el archivo esté escrito
                # (ej. WARNING/rate limit en un sub-step). Comprobamos por archivo.
                subprocess.run(cmd, check=False, capture_output=True, timeout=30)
            except subprocess.TimeoutExpired:
                continue
            matches = list(tmp_path.glob(f"sub_{lang}*.json3"))
            if matches and matches[0].stat().st_size > 100:
                picked = (matches[0], lang)
                break

        if not picked:
            return None

        subs_file, lang = picked
        try:
            data = json.loads(subs_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

        segments = _json3_to_segments(data)
        if not segments:
            return None

        return {"segments": segments, "language": _normalize_lang(lang)}


def _lang_from_filename(name: str) -> str:
    """`sub.es.json3` → `es`. Fallback: primer 2-char token."""
    parts = name.split(".")
    for p in parts:
        if 2 <= len(p) <= 5 and p.replace("-", "").isalpha():
            return p
    return "en"


def _normalize_lang(lang: str) -> str:
    """`es-419` / `es-ES` → `es`."""
    return lang.split("-")[0].lower()


def _json3_to_segments(data: dict) -> list[dict]:
    """Convierte el JSON3 de YouTube al shape de pipeline.transcribe().

    Cada `event` de JSON3 se convierte en 1 segmento con words[].
    Filtra eventos sin `segs` (marcadores de posición vacíos).
    """
    events = data.get("events") or []
    segments = []
    for ev in events:
        segs = ev.get("segs") or []
        if not segs:
            continue
        ev_start_ms = float(ev.get("tStartMs", 0))
        ev_dur_ms = float(ev.get("dDurationMs", 0))

        words = []
        text_parts = []
        for i, seg in enumerate(segs):
            raw = seg.get("utf8") or ""
            token = raw.strip()
            if not token:
                # Espacios entre palabras: los usamos para separar text pero no como word aparte.
                continue
            offset_ms = float(seg.get("tOffsetMs", 0))
            w_start = (ev_start_ms + offset_ms) / 1000.0
            # Duración de la palabra: hasta el offset del siguiente seg no vacío,
            # o hasta el final del evento si es la última.
            next_offset_ms = ev_dur_ms
            for j in range(i + 1, len(segs)):
                nxt_utf = (segs[j].get("utf8") or "").strip()
                if nxt_utf:
                    next_offset_ms = float(segs[j].get("tOffsetMs", ev_dur_ms))
                    break
            w_end = (ev_start_ms + next_offset_ms) / 1000.0
            if w_end <= w_start:
                w_end = w_start + 0.2  # mínimo razonable
            words.append({"word": raw, "start": w_start, "end": w_end})
            text_parts.append(token)

        if not words:
            continue
        segments.append({
            "start": words[0]["start"],
            "end": words[-1]["end"],
            "text": " ".join(text_parts),
            "words": words,
        })
    return segments


def ensure_available() -> bool:
    """yt-dlp ya se comprueba en pipeline.ensure_tools(). Este módulo no
    añade dependencias nuevas — usa el mismo binario. Retornamos siempre
    True si yt-dlp está disponible."""
    return shutil.which("yt-dlp") is not None
