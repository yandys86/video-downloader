"""Wrapper para Claude API: detección de highlights + reescritura de guiones."""

import json
import logging
import re

from anthropic import Anthropic

from .settings import settings

log = logging.getLogger("llm")


_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


HIGHLIGHTS_SYSTEM = (
    "Analizas transcripciones de vídeo y extraes los momentos con más potencial viral "
    "para vídeo corto (YouTube Shorts, TikTok, Reels). Devuelves siempre JSON estricto."
)

HIGHLIGHTS_USER = """A partir de la transcripción de un vídeo (segmentos con start/end/text en segundos), \
identifica los top {n} momentos que funcionarían como Shorts autocontenidos de 20-55 segundos.

Criterios de un buen highlight:
- Hook natural en la primera frase (pregunta provocadora, afirmación fuerte, cifra concreta)
- Idea autocontenida (se entiende sin haber visto lo anterior)
- Densidad emocional o informativa (evita descripciones neutras, saludos, transiciones)
- Duración entre 20 y 55 segundos

Devuelve JSON con esta forma exacta:
{{"highlights": [
  {{"start": 12.34, "end": 53.10, "hook": "primera frase", "reason": "por qué engancha"}}
]}}

No incluyas ningún texto fuera del JSON.

Transcripción:
{transcript_json}
"""


def find_highlights(transcript_segments: list[dict], n: int) -> list[dict]:
    """Dado un transcript, devuelve top N highlights.

    transcript_segments: lista de {start, end, text}
    """
    # Compactamos el transcript para no meter miles de tokens innecesarios.
    compact = [
        {"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()}
        for s in transcript_segments
    ]
    msg = client().messages.create(
        model=settings.anthropic_model,
        max_tokens=2000,
        system=HIGHLIGHTS_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": HIGHLIGHTS_USER.format(
                    n=n, transcript_json=json.dumps(compact, ensure_ascii=False)
                ),
            }
        ],
    )
    text = "".join(block.text for block in msg.content if block.type == "text")
    data = _parse_json_lenient(text)
    highlights = data.get("highlights", [])
    return [
        h for h in highlights
        if isinstance(h.get("start"), (int, float))
        and isinstance(h.get("end"), (int, float))
        and h["end"] > h["start"]
    ]


REWRITE_SYSTEM = (
    "Reescribes fragmentos de vídeos largos como guiones de Short punchy en el mismo "
    "idioma que el original. Devuelves solo el texto, sin etiquetas ni markdown."
)

REWRITE_USER = """Reescribe este fragmento como guion de YouTube Short de 30-55 segundos hablados.

Estructura obligatoria:
1. HOOK (3-6s) — pregunta o afirmación provocadora que engancha
2. DESARROLLO (20-40s) — la idea desarrollada punchy, frases cortas, sin relleno
3. CTA (2-5s) — "sígueme para más", "guárdalo", "dilo en comentarios"

Mantén el sentido y las palabras clave del original. Escribe en el mismo idioma del fragmento.
No incluyas etiquetas como HOOK/DESARROLLO/CTA — devuelve solo el texto continuo listo para narrar.

Fragmento original:
\"\"\"
{excerpt}
\"\"\"
"""


def rewrite_as_short_script(excerpt: str) -> str:
    msg = client().messages.create(
        model=settings.anthropic_model,
        max_tokens=800,
        system=REWRITE_SYSTEM,
        messages=[{"role": "user", "content": REWRITE_USER.format(excerpt=excerpt.strip())}],
    )
    text = "".join(block.text for block in msg.content if block.type == "text")
    return text.strip()


def _sin_etiquetas(texto: str) -> str:
    """Quita del copy las líneas que son solo etiquetas.

    Se le pide al modelo que las devuelva aparte y aun así las mete dentro,
    con lo que el pie acababa enseñando dos tandas de hashtags seguidas. Fiarse
    de que el modelo obedezca sale más caro que limpiarlo aquí.
    """
    lineas = []
    for l in (texto or "").strip().splitlines():
        palabras = l.split()
        if palabras and all(w.startswith("#") for w in palabras):
            continue                      # línea de solo etiquetas
        lineas.append(l)
    return "\n".join(lineas).strip()


IDIOMAS = {"en": "inglés", "es": "español", "pt": "portugués", "fr": "francés"}


def copy_para_redes(hook: str, transcripcion: str = "",
                    idioma: str | None = None) -> dict:
    """Título, texto para redes y etiquetas, todo en el mismo idioma.

    Devuelve {"titulo": str, "copy": str, "hashtags": [str]}. Se pide el título
    aquí y no aparte porque es la misma llamada y así no puede pasar lo de
    antes: copy en inglés y título en español en el mismo Short.

    Si el modelo falla se cae al gancho. Quedarse sin copy no puede impedir que
    se envíe el vídeo, que es lo que de verdad hace falta.
    """
    idioma = idioma or settings.autoshorts_idioma
    nombre_idioma = IDIOMAS.get(idioma, idioma)
    respaldo = {"titulo": (hook or "").strip(),
                "copy": (hook or "").strip(), "hashtags": ["#Shorts"]}
    if not (hook or transcripcion):
        return respaldo
    try:
        r = client().messages.create(
            model=settings.anthropic_model,
            max_tokens=400,
            messages=[{"role": "user", "content": f"""Prepara la publicación de este clip vertical.

Gancho del clip: {hook}
Transcripción: {transcripcion[:1200]}

Devuelve SOLO este JSON:
{{"titulo": "...", "copy": "...", "hashtags": ["#uno", "#dos", "#tres", "#cuatro"]}}

TODO —título, copy y etiquetas— en {nombre_idioma.upper()}, sea cual sea el
idioma de la transcripción.

"titulo": para YouTube Shorts. Máximo 80 caracteres, con gancho, sin comillas
y sin poner "#Shorts" (se añade luego).

"copy": para TikTok, Instagram y Facebook. Dos partes separadas por una línea
en blanco:
  1. Una frase que se entienda sin ver el vídeo y dé una razón para verlo.
  2. Una pregunta directa al que lee, para que responda.
Máximo 200 caracteres. Nada de "link in bio" ni "like and subscribe".

"hashtags": específicas del contenido, no genéricas. NO las repitas dentro
del copy."""}],
        )
        d = _parse_json_lenient(r.content[0].text)
        cp = _sin_etiquetas(d.get("copy") or "")
        hs = [h if h.startswith("#") else f"#{h}"
              for h in (d.get("hashtags") or []) if h][:6]
        if cp:
            return {"titulo": (d.get("titulo") or hook or "").strip()[:80],
                    "copy": cp, "hashtags": hs or respaldo["hashtags"]}
    except Exception as e:
        log.warning("copy_para_redes falló, uso el gancho: %s", e)
    return respaldo


def _parse_json_lenient(text: str) -> dict:
    """Intenta parsear JSON aunque venga con texto alrededor."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return {}
