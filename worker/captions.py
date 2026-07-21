"""Genera captions .ass estilo karaoke desde word-level timestamps."""

from pathlib import Path


ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,{font},{size},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _fmt_time(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds - h * 3600 - m * 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_ass(
    words: list[dict],
    output_path: str,
    font: str = "Montserrat",
    size: int = 84,
    words_per_line: int = 2,
    highlight_color_bgr: str = "&H0000E5FF&",  # amarillo llameante
    uppercase: bool = True,
) -> None:
    """words: [{"word": str, "start": float, "end": float}]"""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    lines = [ASS_HEADER.format(font=font, size=size)]

    # Agrupamos palabras en líneas de N para que quepa mejor en pantalla.
    groups: list[list[dict]] = []
    buf: list[dict] = []
    for w in words:
        if not w.get("word", "").strip():
            continue
        buf.append(w)
        if len(buf) >= words_per_line:
            groups.append(buf)
            buf = []
    if buf:
        groups.append(buf)

    for group in groups:
        g_start = group[0]["start"]
        g_end = group[-1]["end"]
        # Para cada palabra dentro del grupo emitimos un Dialogue que resalta esa
        # palabra en amarillo y deja las demás en blanco (efecto karaoke).
        for i, active in enumerate(group):
            frag = []
            for j, w in enumerate(group):
                token = w["word"].strip()
                if uppercase:
                    token = token.upper()
                token = token.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
                if i == j:
                    frag.append(f"{{\\c{highlight_color_bgr}}}{token}{{\\c&H00FFFFFF&}}")
                else:
                    frag.append(token)
            text = " ".join(frag)
            start = _fmt_time(active["start"])
            end = _fmt_time(active["end"] if j == i else min(active["end"], g_end))
            lines.append(
                f"Dialogue: 0,{start},{end},Karaoke,,0,0,0,,{{\\an5\\pos(540,1300)}}{text}"
            )

    Path(output_path).write_text("".join(lines), encoding="utf-8")
