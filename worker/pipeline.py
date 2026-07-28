"""Pipeline de generación de Shorts: descarga, transcripción, TTS y composición."""

import json
import shutil
import subprocess
from pathlib import Path
from typing import Callable

from faster_whisper import WhisperModel

from .settings import settings


_whisper: WhisperModel | None = None


def _log(cb: Callable[[str, float], None] | None, stage: str, progress: float) -> None:
    if cb:
        cb(stage, progress)


# ---------------------------------------------------------------------------
# 1. Descarga con yt-dlp
# ---------------------------------------------------------------------------
def download_source(url: str, out_dir: Path, job_id: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(out_dir / f"{job_id}.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", out_template,
        url,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    # Buscamos el archivo generado
    for ext in ("mp4", "mkv", "webm", "m4a"):
        p = out_dir / f"{job_id}.{ext}"
        if p.exists():
            return p
    raise RuntimeError("yt-dlp no produjo archivo")


def download_section(
    url: str,
    start: float,
    duration: float,
    out_dir: Path,
    job_id: str,
) -> Path:
    """Descarga SOLO un tramo del vídeo con yt-dlp --download-sections.

    Selector `best[height<=720]/best`: formato combinado (video+audio en
    el mismo stream, sin DASH separado). Evita el 403 de googlevideo que
    da a veces cuando pides bestvideo+bestaudio (los DASH separados
    requieren firma JS y YouTube lo bloquea sin runtime). 720p es más
    que suficiente para output 9:16.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(out_dir / f"{job_id}.%(ext)s")
    end = start + duration
    section_spec = f"*{start}-{end}"

    # Intento 1: formato combinado simple (sin merge, sin DASH signatures)
    formats_to_try = [
        "best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best",
        # Fallback: cualquier stream
        "best",
    ]

    last_err = ""
    for fmt in formats_to_try:
        cmd = [
            "yt-dlp",
            "-f", fmt,
            "--no-playlist",
            "--download-sections", section_spec,
            "-o", out_template,
            url,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            for ext in ("mp4", "mkv", "webm", "m4a"):
                p = out_dir / f"{job_id}.{ext}"
                if p.exists():
                    return p
        last_err = (res.stderr or "").strip().splitlines()[-8:]

    raise RuntimeError(
        "yt-dlp download_section falló con todos los formatos:\n"
        + "\n".join(last_err if isinstance(last_err, list) else [str(last_err)])
    )


# ---------------------------------------------------------------------------
# 2. Duración con ffprobe
# ---------------------------------------------------------------------------
def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1",
            str(path),
        ]
    )
    return float(out.strip())


def probe_dimensions(path: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0:s=x",
            str(path),
        ]
    ).decode().strip()
    w, h = out.split("x")
    return int(w), int(h)


# ---------------------------------------------------------------------------
# 3. Transcripción con faster-whisper
# ---------------------------------------------------------------------------
def _get_whisper() -> WhisperModel:
    global _whisper
    if _whisper is None:
        _whisper = WhisperModel(
            settings.whisper_model,
            device="cpu",
            compute_type=settings.whisper_compute_type,
        )
    return _whisper


def transcribe(audio_path: Path, language: str | None = None) -> dict:
    """Devuelve {segments: [{start, end, text, words: [...]}], language}.

    Si `language` es None/vacío autodetecta. Forzar el idioma equivocado
    combinado con vad_filter puede descartar todos los segmentos, y
    autodetect con vad_filter en audio sin voz clara puede crashear
    faster-whisper. Hacemos fallback a vad_filter=False en esos casos.
    """
    lang = language or (settings.whisper_language or None)

    def _run(vad: bool):
        return _get_whisper().transcribe(
            str(audio_path),
            language=lang,
            word_timestamps=True,
            vad_filter=vad,
        )

    try:
        segments_iter, info = _run(True)
        segments = _consume_segments(segments_iter)
    except ValueError as e:
        # faster-whisper 1.0.x: `max() arg is an empty sequence` cuando VAD
        # descarta el audio entero y no queda nada para detectar idioma.
        if "empty sequence" not in str(e):
            raise
        segments_iter, info = _run(False)
        segments = _consume_segments(segments_iter)

    return {"segments": segments, "language": info.language}


def _consume_segments(segments_iter) -> list[dict]:
    out = []
    for seg in segments_iter:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({"word": w.word, "start": float(w.start), "end": float(w.end)})
        out.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
            "words": words,
        })
    return out


# ---------------------------------------------------------------------------
# 4. TTS con edge-tts
# ---------------------------------------------------------------------------
def synthesize_tts(text: str, voice: str, rate: str, out_mp3: Path) -> None:
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "edge-tts",
        "--voice", voice,
        "--rate", rate,
        "--text", text,
        "--write-media", str(out_mp3),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        # Extraer el motivo real del stderr en lugar de propagar
        # "returned non-zero exit status 1" (opaco).
        err = (res.stderr or "").strip().splitlines()
        last = err[-1] if err else ""
        # 403 típico de Microsoft rotando tokens en edge-tts obsoleto.
        if "403" in last or "WSServerHandshakeError" in last:
            raise RuntimeError(
                "El servicio de voz (edge-tts) está temporalmente inaccesible. "
                "Es un problema conocido: Microsoft rota tokens y el paquete "
                "necesita actualización. Reintenta en unos minutos o contacta al admin."
            )
        raise RuntimeError(f"edge-tts falló: {last or 'sin detalles'}")
    # Verifica que el archivo se generó (a veces exit 0 pero sin archivo).
    if not out_mp3.exists() or out_mp3.stat().st_size < 100:
        raise RuntimeError("edge-tts no generó audio válido (archivo vacío)")


# ---------------------------------------------------------------------------
# 5. Fondos visuales según estilo
# ---------------------------------------------------------------------------
def build_background_original_crop(
    source: Path, start: float, duration: float, out_mp4: Path
) -> None:
    """Recorta un tramo del vídeo original y lo escala a 1080x1920."""
    w, h = probe_dimensions(source)
    if h >= w:  # vertical/cuadrado
        vf = "scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920"
    else:       # horizontal
        vf = "crop='ih*9/16':ih,scale=1080:1920,setsar=1"
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-i", str(source), "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-an", str(out_mp4),
    ], check=True, capture_output=True)


def build_background_blur(
    source: Path, start: float, duration: float, out_mp4: Path
) -> None:
    """Blur del original de fondo + versión centrada nítida encima."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    # Fondo blureado escalado a 1080x1920, y encima el vídeo centrado con letterbox.
    filter_complex = (
        "[0:v]split=2[bg][fg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,gblur=sigma=25[bgb];"
        "[fg]scale=1080:-1[fgs];"
        "[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    )
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-i", str(source), "-t", str(duration),
        "-filter_complex", filter_complex,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-an", str(out_mp4),
    ], check=True, capture_output=True)


def build_background_loop(
    loop_mp4: Path, duration: float, out_mp4: Path
) -> None:
    """Loop de un vídeo (gameplay/satisfying) hasta cubrir duración."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", str(loop_mp4), "-t", str(duration),
        "-vf", "scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920,setsar=1",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-an",
        str(out_mp4),
    ], check=True, capture_output=True)


def build_background_gradient(duration: float, out_mp4: Path) -> None:
    """Gradiente animado (fallback si el filtro `gradients` no está disponible)."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    # Intento 1: filtro `gradients` (ffmpeg ≥5.1).
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"gradients=s=1080x1920:type=radial:c0=0x1a1a2e:c1=0x16213e:c2=0x0f3460:duration={duration}:speed=0.02",
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
            str(out_mp4),
        ], check=True, capture_output=True)
        return
    except subprocess.CalledProcessError:
        pass
    # Fallback: color estático con zoompan sutil.
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=0x0f3460:s=1080x1920:d={duration}",
        "-vf", "zoompan=z='min(zoom+0.0005,1.15)':d=1:s=1080x1920",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        str(out_mp4),
    ], check=True, capture_output=True)


# ---------------------------------------------------------------------------
# 6. Composición final: fondo + voz + captions + música opcional
# ---------------------------------------------------------------------------
def compose_final(
    bg_mp4: Path,
    voice_mp3: Path,
    captions_ass: Path | None,
    out_mp4: Path,
    music_mp3: Path | None = None,
    watermark_text: str = "",
) -> None:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)

    # Cadena de filtros de vídeo: captions (opcional) + watermark (opcional).
    # captions_ass=None => Reel sin subtítulos (útil para música/karaoke, donde
    # las auto-captions salen mal). Si no hay ningún filtro, ni siquiera pasamos
    # -vf para que ffmpeg pueda copiar el vídeo tal cual (más rápido).
    vf_filters: list[str] = []
    if captions_ass is not None:
        # Escapamos la ruta del .ass para ffmpeg (filtro `ass=` es exquisito con paths).
        ass_escaped = str(captions_ass).replace(":", "\\:").replace("'", "\\'")
        vf_filters.append(f"ass='{ass_escaped}'")
    if watermark_text.strip():
        # Escapamos comillas y ':' para drawtext (que también parsea :).
        wm = watermark_text.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")
        vf_filters.append(
            f"drawtext=text='{wm}':fontcolor=white@0.75:fontsize=38:"
            f"borderw=2:bordercolor=black@0.7:"
            f"x=w-tw-24:y=h-th-32"
        )
    vf = ",".join(vf_filters)
    vf_args = ["-vf", vf] if vf else []

    if music_mp3 is None:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(bg_mp4),
            "-i", str(voice_mp3),
            *vf_args,
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            str(out_mp4),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(bg_mp4),
            "-i", str(voice_mp3),
            "-i", str(music_mp3),
            "-filter_complex",
            "[2:a]volume=0.12,aloop=loop=-1:size=2e+09[m];"
            "[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
            "-map", "0:v", "-map", "[a]",
            *vf_args,
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            str(out_mp4),
        ]
    subprocess.run(cmd, check=True, capture_output=True)


# ---------------------------------------------------------------------------
# Utilidad: extraer sólo audio del source para transcripción rápida
# ---------------------------------------------------------------------------
def extract_audio(source: Path, out_mp3: Path) -> None:
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-i", str(source),
        "-vn", "-acodec", "libmp3lame", "-q:a", "4",
        str(out_mp3),
    ], check=True, capture_output=True)


def extract_audio_slice(source: Path, start: float, duration: float, out_mp3: Path) -> None:
    """Extrae un slice de audio del source (para modo voice_mode='original').

    Corta [start, start+duration] del audio de la fuente y lo guarda como mp3.
    Mucho más rápido que TTS + re-transcribe porque no hay red ni Whisper.
    """
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(start), "-i", str(source), "-t", str(duration),
        "-vn", "-acodec", "libmp3lame", "-q:a", "4",
        str(out_mp3),
    ], check=True, capture_output=True)


def ensure_tools() -> None:
    for tool in ("ffmpeg", "ffprobe", "yt-dlp", "edge-tts"):
        if not shutil.which(tool):
            raise RuntimeError(f"Herramienta requerida no encontrada en PATH: {tool}")
