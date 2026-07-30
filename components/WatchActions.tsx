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
 * En iOS 17+ el reproductor fullscreen nativo NO tiene 'Guardar en Fotos'
 * (movieron 'Save Video' fuera del share menu accesible desde web).
 * Los dos métodos que SÍ funcionan siempre:
 *   1. Long-press sobre <video> inline → menú Safari con "Guardar en Fotos".
 *      Un tap, sin límite de tamaño. Requiere que el user sepa hacerlo.
 *   2. Descargar como fichero → abre en Archivos → user toca vídeo →
 *      Compartir → "Guardar vídeo". Tres taps, garantizado.
 * Web Share API con File falla en iOS para vídeos >~50-100 MB.
 *
 * Android: Web Share con File suele funcionar; fallback descarga
 * (Descargas es visible como álbum en la galería nativa).
 */
export default function WatchActions({ src, filename }: Props) {
  const [os, setOs] = useState<OS>("other");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function saveToGallery() {
    setMsg(null);
    setBusy(true);
    try {
      if (os === "android" || os === "other") {
        const ok = await tryWebShare();
        if (ok) {
          setMsg("✓ Selecciona «Fotos» o «Guardar vídeo» en el menú");
          return;
        }
      } else {
        // iOS: intentamos share primero (funciona para vídeos pequeños).
        const ok = await tryWebShare();
        if (ok) {
          setMsg("✓ Elige «Guardar vídeo» en el menú");
          return;
        }
        setMsg("El vídeo es grande — usa long-press sobre el vídeo (ver arriba) o descárgalo como fichero.");
        return;
      }
      // Fallback Android/desktop: descarga directa
      const a = document.createElement("a");
      a.href = `${src}?dl=1`;
      a.download = filename;
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
    <div className="space-y-3">
      {os === "ios" && (
        <div className="rounded-xl border-2 border-fuchsia-400/60 bg-fuchsia-500/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-fuchsia-200/80 mb-1">
            📱 iPhone — método más rápido
          </div>
          <div className="text-base text-white leading-relaxed">
            👆 <b>Mantén pulsado</b> sobre el vídeo de arriba
            <br />
            → toca <b>«Guardar en Fotos»</b>
          </div>
          <div className="mt-2 text-xs text-white/50">
            Sin límite de tamaño. Si no aparece el menú, espera 2s a que
            cargue el vídeo o pruébalo pausado.
          </div>
        </div>
      )}

      <button
        onClick={saveToGallery}
        disabled={busy}
        className="block w-full text-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-60"
      >
        {busy ? "Preparando…" : "📤 Compartir / Guardar en galería"}
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

      {os === "ios" && (
        <details className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
          <summary className="cursor-pointer font-medium text-white">
            Si el long-press no te funciona…
          </summary>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs">
            <li>Toca <b>«Descargar como fichero»</b> arriba</li>
            <li>Safari te preguntará si quieres descargar — dile sí</li>
            <li>Abre la app <b>Archivos</b> → Descargas → tu Reel</li>
            <li>Toca el vídeo → botón compartir <b>⤴︎</b> → <b>«Guardar vídeo»</b></li>
            <li>Ya está en Fotos</li>
          </ol>
          <div className="mt-2 text-xs text-white/40">
            Este método siempre funciona, sea cual sea el tamaño del vídeo.
          </div>
        </details>
      )}
    </div>
  );
}
