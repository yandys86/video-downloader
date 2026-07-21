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
    """Devuelve {segments: [{start, end, text, words: [...]}], language}."""
    lang = language or settings.whisper_language
    segments_iter, info = _get_whisper().transcribe(
        str(audio_path),
        language=lang,
        word_timestamps=True,
        vad_filter=True,
    )
    segments = []
    for seg in segments_iter:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({"word": w.word, "start": float(w.start), "end": float(w.end)})
        segments.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
            "words": words,
        })
    return {"segments": segments, "language": info.language}


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
    subprocess.run(cmd, check=True, capture_output=True)


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
    captions_ass: Path,
    out_mp4: Path,
    music_mp3: Path | None = None,
) -> None:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    # Escapamos la ruta del .ass para ffmpeg (filtro `ass=` es exquisito con paths).
    ass_escaped = str(captions_ass).replace(":", "\\:").replace("'", "\\'")

    if music_mp3 is None:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(bg_mp4),
            "-i", str(voice_mp3),
            "-vf", f"ass='{ass_escaped}'",
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
            "-vf", f"ass='{ass_escaped}'",
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


def ensure_tools() -> None:
    for tool in ("ffmpeg", "ffprobe", "yt-dlp", "edge-tts"):
        if not shutil.which(tool):
            raise RuntimeError(f"Herramienta requerida no encontrada en PATH: {tool}")
