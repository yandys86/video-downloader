/**
 * Landing amigable para el enlace que envían Telegram/email cuando el MP4
 * supera el límite. Muestra el vídeo reproducible en el navegador y ofrece:
 *  - Guardar a la galería (long-press o compartir) con instrucciones por SO
 *  - Descargar como fichero (attachment) si prefieren
 */

import Link from "next/link";
import WatchActions from "@/components/WatchActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu Reel" };

export default function WatchPage({
  params,
}: {
  params: { jobId: string; filename: string };
}) {
  const { jobId, filename } = params;
  // Reutilizamos el streaming del route API. Sin ?dl para reproducir inline.
  const src = `/shorts/output/${encodeURIComponent(jobId)}/${encodeURIComponent(filename)}`;

  return (
    <main className="mx-auto max-w-md px-4 py-6 pt-16">
      <div className="rounded-2xl overflow-hidden bg-black shadow-2xl shadow-violet-500/10 border border-white/10">
        {/*
          controls: player nativo con botón compartir en fullscreen iOS.
          playsInline: obligatorio para que long-press → 'Guardar en Fotos'
          funcione en Safari iOS (si va fullscreen no hay long-press).
          preload=auto para que el long-press tenga el vídeo listo YA.
        */}
        <video
          src={src}
          controls
          playsInline
          preload="auto"
          className="w-full aspect-[9/16] bg-black"
        />
      </div>

      <div className="mt-4">
        <WatchActions src={src} filename={filename} />
      </div>

      <div className="mt-6 text-center">
        <Link href="/shorts" className="text-xs text-white/40 hover:text-white/70">
          ← Volver a crear otro Reel
        </Link>
      </div>
    </main>
  );
}
