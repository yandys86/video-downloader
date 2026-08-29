"""Un enlace de YouTube → N Shorts publicados y programados en tu canal.

Encadena lo que ya existía por separado: `run_analyze` encuentra los momentos
con gancho, `run_generate` los renderiza, y `youtube_up` los sube con fecha.

Vive en el worker y no en el webhook del bot a propósito. Analizar y renderizar
tarda entre 5 y 20 minutos: una ruta de Next.js no puede esperar eso, y el bot
tampoco debe quedarse colgado. El bot lanza el trabajo y se olvida; el worker
avisa por Telegram al terminar.
"""
from __future__ import annotations

import logging
import traceback
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from . import llm, storage, tasks, telegram, youtube_up
from .settings import settings

log = logging.getLogger("autoshorts")


def _aviso(chat_id: str | None, texto: str) -> None:
    if chat_id and telegram.is_configured():
        try:
            telegram.send_message(chat_id, texto)
        except Exception as e:      # avisar nunca puede tumbar el trabajo
            log.warning("no se pudo avisar a %s: %s", chat_id, e)


def _local(d: datetime) -> str:
    return f"{d.astimezone(ZoneInfo(settings.tz_publicacion)):%d/%m a las %H:%M}"


def _ejecutar(fn, db: str, job_id: str) -> dict:
    """Corre una fase EN ESTE MISMO HILO y devuelve su job terminado.

    Nada de `tasks.submit()` aquí. El pool es un ThreadPoolExecutor de 2 hilos:
    si este trabajo ocupara una plaza mientras espera a un hijo que también
    necesita plaza, dos peticiones simultáneas bloquearían el worker entero,
    en silencio y para siempre. `run_analyze` y `run_generate` son funciones
    síncronas normales, así que llamarlas directamente gasta UNA sola plaza
    para toda la cadena.
    """
    fn(job_id)
    j = storage.get_job(db, job_id)
    if j is None:
        raise RuntimeError(f"el job {job_id} desapareció de la base")
    return j


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pie(n: int, total: int, copy: str, etiquetas: list, cuando) -> str:
    """Pie del documento: el copy en bloque <code>, que en Telegram se copia
    entero con un toque. Es la diferencia entre publicar desde el móvil y
    tener que ir seleccionando texto a mano."""
    pegable = copy + ("\n\n" + " ".join(etiquetas) if etiquetas else "")
    cab = f"<b>Short {n}/{total}</b> · sale el {_local(cuando)}\n\n"
    sobra = len(cab) + len(pegable) + 32 - 1024      # tope de Telegram
    if sobra > 0:
        # Se recorta el copy y NUNCA las etiquetas: sin ellas el Short no se
        # encuentra, y reescribirlas a mano es justo lo que esto evita.
        copy = copy[:max(0, len(copy) - sobra - 1)].rsplit(" ", 1)[0] + "…"
        pegable = copy + ("\n\n" + " ".join(etiquetas) if etiquetas else "")
    return cab + f"<code>{_esc(pegable)}</code>"


def run_autoshorts(job_id: str) -> None:
    db = settings.db_path
    job = storage.get_job(db, job_id)
    if job is None:
        return
    entrada = job["input"]
    url = entrada["url"]
    chat_id = entrada.get("chat_id")
    cuantos = int(entrada.get("n") or settings.autoshorts_por_video)
    cada = int(entrada.get("cada_horas") or settings.autoshorts_cada_horas)

    try:
        # ── 1. Analizar ───────────────────────────────────────────────
        storage.update_job(db, job_id, status="running", stage="analizando",
                           progress=0.05)
        _aviso(chat_id, "🔎 Analizando el vídeo… (esto tarda unos minutos)")

        hijo_a = storage.new_job(db, "analyze", {"url": url},
                                 client_ip=entrada.get("client_ip", ""))
        ja = _ejecutar(tasks.run_analyze, db, hijo_a)
        if ja["status"] != "done":
            raise RuntimeError(f"el análisis falló: {ja.get('error') or 'sin detalle'}")

        resultado_a = ja.get("result") or {}
        highlights = resultado_a.get("highlights") or []
        if len(highlights) < cuantos:
            raise RuntimeError(
                f"solo se encontraron {len(highlights)} momentos aprovechables "
                f"y hacen falta {cuantos}. Prueba con un vídeo más largo.")

        # Los highlights vienen cortos (7-15 s). Se extienden hasta `dura` sin
        # salirse del vídeo: si no cabe hacia delante, se retrocede el inicio.
        dura = float(entrada.get("duracion") or settings.autoshorts_duracion_seg)
        total = float(resultado_a.get("duration") or 0)
        rangos = []
        for h in highlights[:cuantos]:
            ini = float(h["start"])
            fin = ini + dura
            if total and fin > total:
                fin = total
                ini = max(0.0, total - dura)
            rangos.append({"start": round(ini, 2), "end": round(fin, 2),
                           "hook": h.get("hook", "")})
        log.info("rangos: %s", [f"{r['start']:.0f}-{r['end']:.0f}s" for r in rangos])

        # ── 2. Renderizar ─────────────────────────────────────────────
        storage.update_job(db, job_id, stage="renderizando", progress=0.35)
        _aviso(chat_id, f"✂️ {len(highlights)} momentos detectados. "
                        f"Montando los {cuantos} mejores…")

        hijo_g = storage.new_job(
            db, "generate",
            {"parent_id": hijo_a,
             # rangos explícitos, no `highlight_indices`: así se controla la
             # duración exacta sin tocar el análisis, que comparte con la web.
             "custom_ranges": rangos,
             "style": entrada.get("style", "blur"),
             "voice_mode": entrada.get("voice_mode", "original"),
             "captions": True,
             "rewrite": False},
            client_ip=entrada.get("client_ip", ""), parent_id=hijo_a)
        jg = _ejecutar(tasks.run_generate, db, hijo_g)
        if jg["status"] != "done":
            raise RuntimeError(f"el montaje falló: {jg.get('error') or 'sin detalle'}")

        shorts = (jg.get("result") or {}).get("shorts") or []
        if not shorts:
            raise RuntimeError("el montaje no produjo ningún Short")

        # ── 3. Subir con fecha ────────────────────────────────────────
        storage.update_job(db, job_id, stage="subiendo", progress=0.75)
        fechas = youtube_up.horas_de_publicacion(len(shorts), cada_horas=cada)

        subidos, fallidos = [], []
        for i, (s, cuando) in enumerate(zip(shorts, fechas), 1):
            mp4 = Path(s["file"])
            if not mp4.exists():
                fallidos.append((i, "el fichero ya no está en disco"))
                continue
            titulo = (s.get("hook") or "").strip() or f"Short {i}"
            if not titulo.endswith("#Shorts"):
                titulo = f"{titulo[:88]} #Shorts"
            try:
                vid = youtube_up.subir(
                    mp4, titulo,
                    descripcion=f"{s.get('hook', '')}\n\n#Shorts",
                    tags=["shorts"], publicar_en=cuando)
                subidos.append({"n": i, "id": vid, "cuando": cuando,
                                "titulo": titulo})

                # El MP4 al chat, con su copy listo para pegar en TikTok e
                # Instagram. Va AQUÍ, antes de que la limpieza borre el
                # fichero: después ya no habría nada que mandar.
                if chat_id:
                    c = llm.copy_para_redes(s.get("hook", ""), s.get("script", ""))
                    telegram.send_document(
                        chat_id, mp4,
                        _pie(i, len(shorts), c["copy"], c["hashtags"], cuando))
            except Exception as e:
                # Un Short que falla no puede llevarse por delante a los demás.
                log.exception("Short %d no se pudo subir", i)
                fallidos.append((i, str(e)[:120]))

        if not subidos:
            raise RuntimeError("ningún Short llegó a subirse: "
                               + "; ".join(f"#{n} {m}" for n, m in fallidos))

        storage.update_job(
            db, job_id, status="done", stage="done", progress=1.0,
            result={"subidos": [{**x, "cuando": x["cuando"].isoformat()}
                                for x in subidos],
                    "fallidos": fallidos,
                    "analyze_job": hijo_a, "generate_job": hijo_g})

        lineas = [f"✅ <b>{len(subidos)} Shorts programados</b>", ""]
        for x in subidos:
            lineas.append(f"  {x['n']}. {_local(x['cuando'])}")
            lineas.append(f"     https://youtu.be/{x['id']}")
        if fallidos:
            lineas.append("")
            lineas.append(f"⚠️ {len(fallidos)} no se pudieron subir:")
            lineas += [f"  #{n}: {m}" for n, m in fallidos]
        lineas.append("")
        lineas.append("<i>Quedan privados hasta su hora; YouTube los publica "
                      "solo. Arriba tienes los MP4 con su copy: toca el bloque "
                      "gris y se copia entero, etiquetas incluidas.</i>")
        _aviso(chat_id, "\n".join(lineas))

    except Exception as e:
        log.error("autoshorts %s falló: %s", job_id, e)
        storage.update_job(db, job_id, status="error", stage="error",
                           error=str(e)[:500])
        _aviso(chat_id, f"❌ No salió: {str(e)[:300]}")
        log.debug(traceback.format_exc())
