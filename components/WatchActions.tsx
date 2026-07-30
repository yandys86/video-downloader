"use client";

import { useEffect, useState } from "react";

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
 * Realidad en iOS 17+:
 *  - Long-press sobre <video> ya no ofrece "Guardar en Fotos" para vídeos
 *    grandes servidos por HTTP.
 *  - El fullscreen player nativo desde web tampoco tiene "Save Video".
 *  - Web Share API con File falla para vídeos > ~50-100 MB.
 *
 * → La única vía FIABLE en iOS es: descargar al iPhone (va a Archivos) y
 *   desde Archivos compartir a Fotos. Instrucciones en 2 pasos claros.
 *
 * Android: Web Share con File suele funcionar; si no, descarga → aparece
 * en el álbum Descargas de la galería nativa.
 *
 * Desktop: descarga directa.
 */
export default function WatchActions({ src, filename }: Props) {
  const [os, setOs] = useState<OS>("other");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => setOs(detectOS()), []);

  async function tryWebShare(): Promise<boolean> {
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
      if (e?.name === "AbortError") return true;
      return false;
    }
  }

  function triggerDownload() {
    const a = document.createElement("a");
    a.href = `${src}?dl=1`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded(true);
  }

  async function primaryAction() {
    setMsg(null);
    setBusy(true);
    try {
      if (os === "ios") {
        // iOS: probamos share primero (funciona para clips pequeños),
        // si falla descargamos y mostramos instrucciones.
        const ok = await tryWebShare();
        if (ok) {
          setMsg("✓ Elige «Guardar vídeo» en el menú");
          return;
        }
        triggerDownload();
        return;
      }
      // Android: Web Share
      if (os === "android") {
        const ok = await tryWebShare();
        if (ok) {
          setMsg("✓ Elige «Fotos» o «Guardar vídeo» en el menú");
          return;
        }
      }
      // Desktop y Android fallback: descarga directa
      triggerDownload();
      setMsg(
        os === "android"
          ? "Descargando… lo verás en el álbum Descargas de tu Galería"
          : "Descargando en tu carpeta de Descargas",
      );
    } finally {
      setBusy(false);
    }
  }

  const btnLabel =
    os === "ios"
      ? "⬇︎ Descargar al iPhone"
      : os === "android"
        ? "📤 Guardar / Compartir"
        : "⬇︎ Descargar";

  return (
    <div className="space-y-3">
      <button
        onClick={primaryAction}
        disabled={busy}
        className="block w-full text-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-60"
      >
        {busy ? "Preparando…" : btnLabel}
      </button>

      {os === "ios" && (
        <div className="rounded-xl border-2 border-fuchsia-400/50 bg-fuchsia-500/10 p-4">
          <div className="text-xs uppercase tracking-wide text-fuchsia-200/80 mb-2">
            📱 Pasar el Reel a Fotos en iPhone
          </div>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-white/85">
            <li>
              Toca <b>«Descargar al iPhone»</b> arriba. Safari te preguntará
              si quieres descargar — dale <b>«Descargar»</b>.
              {downloaded && (
                <div className="mt-1 text-xs text-emerald-300">
                  ✓ Descarga iniciada, mira el icono ⤓ arriba a la derecha de Safari
                </div>
              )}
            </li>
            <li>
              Abre la app <b>Archivos</b> (la carpeta azul) →{" "}
              <b>Descargas</b> → toca tu Reel.
            </li>
            <li>
              En el reproductor toca el botón <b>compartir ⤴︎</b> abajo a la
              izquierda → desliza y toca <b>«Guardar vídeo»</b>.
            </li>
            <li>Ya está en tu app <b>Fotos</b>. 🎉</li>
          </ol>
          <div className="mt-3 text-[11px] text-white/40">
            Safari no puede guardar directo a Fotos desde una web —
            este rodeo es lo más rápido posible.
          </div>
        </div>
      )}

      {os === "android" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
          Se abre el menú compartir de Android — elige <b>«Fotos»</b>,{" "}
          <b>«Galería»</b> o <b>«Guardar vídeo»</b>. Si no, el vídeo cae en{" "}
          Descargas (visible como álbum en tu Galería).
        </div>
      )}

      {msg && (
        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100 text-center">
          {msg}
        </div>
      )}
    </div>
  );
}
