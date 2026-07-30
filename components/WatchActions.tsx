"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  filename: string;
};

type OS = "ios" | "android" | "other";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/**
 * Botones de guardar/descargar para /shorts/watch.
 *
 * iOS: Safari NO deja guardar directo a Fotos desde un <a download>. Lo que sí
 * funciona:
 *   1. Long-press sobre <video> que reproduce inline → menú nativo con
 *      "Guardar en Fotos" (nuestra ruta MÁS fiable).
 *   2. Fullscreen nativo (webkitEnterFullscreen) → botón compartir del player
 *      → "Guardar vídeo".
 *   3. Web Share API con File (falla si el mp4 pesa mucho o iOS no lo acepta).
 *
 * Android: Chrome soporta Web Share con File decentemente. Fallback: descarga
 * como fichero (el Reel aparece en el álbum Descargas de la galería).
 *
 * Desktop: descarga directa (attachment).
 */
export default function WatchActions({ src, filename }: Props) {
  const [os, setOs] = useState<OS>("other");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setOs(detectOS());
    // Buscar el <video> del page (está en el server component encima).
    videoRef.current = document.querySelector("video");
  }, []);

  async function trySaveWebShare(): Promise<boolean> {
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) return false;
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "video/mp4" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Mi Reel" });
        return true;
      }
      return false;
    } catch (e: any) {
      if (e?.name === "AbortError") return true; // user canceled — no error real
      return false;
    }
  }

  async function saveToGallery() {
    setMsg(null);
    setBusy(true);
    setShowHint(false);
    try {
      if (os === "ios") {
        // iOS: intentamos primero fullscreen nativo — desde ahí el botón
        // compartir del player tiene "Guardar vídeo" que va DIRECTO a Fotos.
        const v = videoRef.current;
        if (v && typeof (v as any).webkitEnterFullscreen === "function") {
          try {
            await v.play(); // requerido por iOS antes de fullscreen
          } catch {}
          try {
            (v as any).webkitEnterFullscreen();
            setMsg("En el reproductor: pulsa ⤴︎ compartir → «Guardar vídeo»");
            setShowHint(true);
            return;
          } catch {}
        }
        // Fallback iOS: Web Share API
        const ok = await trySaveWebShare();
        if (ok) return;
        // Último recurso iOS: instrucciones de long-press
        setMsg(null);
        setShowHint(true);
        return;
      }

      // Android / otros: Web Share API con file (Chrome Android lo hace bien).
      const ok = await trySaveWebShare();
      if (ok) {
        setMsg("✓ Selecciona «Fotos» o «Guardar vídeo» en el menú");
        return;
      }
      // Fallback Android/desktop: descarga directa
      const a = document.createElement("a");
      a.href = `${src}?dl=1`;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg(
        os === "android"
          ? "Descargando… lo verás en la carpeta Descargas de tu Galería"
          : "Descargando en tu carpeta de Descargas",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {os === "ios" && (
        <div className="rounded-xl border-2 border-fuchsia-400/50 bg-fuchsia-500/10 p-3 text-center">
          <div className="text-xs text-fuchsia-100/80 mb-1">📱 iPhone — el método más rápido:</div>
          <div className="text-sm text-white font-medium">
            👆 <b>Mantén pulsado</b> sobre el vídeo de arriba<br />
            → <b>«Guardar en Fotos»</b>
          </div>
        </div>
      )}

      <button
        onClick={saveToGallery}
        disabled={busy}
        className="block w-full text-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-60"
      >
        {busy ? "Preparando…" : os === "ios" ? "▶︎ Abrir en reproductor iOS" : "📱 Guardar en galería"}
      </button>

      <a
        href={`${src}?dl=1`}
        download={filename}
        className="block w-full text-center rounded-lg bg-white/5 border border-white/15 py-3 text-sm text-white/80 hover:bg-white/10"
      >
        ⬇︎ Descargar como fichero
      </a>

      {msg && (
        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100 text-center">
          {msg}
        </div>
      )}

      {showHint && os === "ios" && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 space-y-1">
          <div className="font-medium text-white">Si no ves «Guardar vídeo»:</div>
          <div>· Espera 1-2 segundos a que cargue el vídeo</div>
          <div>· En el reproductor fullscreen, el botón compartir es el ⤴︎ arriba-derecha</div>
          <div>· O vuelve atrás y mantén pulsado sobre el vídeo pequeño</div>
        </div>
      )}
    </div>
  );
}
