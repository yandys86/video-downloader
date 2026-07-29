"use client";

import { useState } from "react";

type Props = {
  src: string;
  filename: string;
};

/**
 * Botones de guardar/descargar para /shorts/watch.
 *
 * "Guardar en galería" usa navigator.share con un File (Web Share Level 2):
 * en iOS abre el share sheet nativo con "Guardar vídeo" — el MP4 va directo
 * a Fotos. Si el navegador no soporta share con files (Safari <15, Chrome
 * viejo), abrimos el vídeo en el reproductor nativo para que el user use
 * el botón compartir del propio player como fallback.
 */
export default function WatchActions({ src, filename }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveToGallery() {
    setMsg(null);
    setBusy(true);
    try {
      // Descargar como blob para poder compartirlo como File
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "video/mp4" });

      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share({
            files: [file],
            title: "Mi Reel",
            text: "Reel generado con TuVideoDown",
          });
          setMsg("✓ Selecciona «Guardar vídeo» en el menú");
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") {
            setMsg(null);
            return;
          }
          // Otro error → fallback
        }
      }

      // Fallback: abrir el vídeo en player nativo — long-press → Guardar en Fotos
      window.open(src, "_blank");
      setMsg("Toca el botón compartir del vídeo → «Guardar vídeo»");
    } catch (e: any) {
      setMsg(`Error: ${e.message}. Prueba «Descargar como fichero» abajo.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={saveToGallery}
        disabled={busy}
        className="block w-full text-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-60"
      >
        {busy ? "Preparando…" : "📱 Guardar en galería"}
      </button>
      <a
        href={`${src}?dl=1`}
        className="block w-full text-center rounded-lg bg-white/5 border border-white/15 py-3 text-sm text-white/80 hover:bg-white/10"
      >
        ⬇︎ Descargar como fichero
      </a>
      {msg && (
        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100 text-center">
          {msg}
        </div>
      )}
    </div>
  );
}
