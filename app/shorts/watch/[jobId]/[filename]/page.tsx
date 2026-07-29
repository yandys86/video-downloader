/**
 * Landing amigable para el enlace que envían Telegram/email cuando el MP4
 * supera el límite. Muestra el vídeo reproducible en el navegador y ofrece:
 *  - Guardar a la galería (long-press o compartir) con instrucciones por SO
 *  - Descargar como fichero (attachment) si prefieren
 */

import Link from "next/link";
import WatchInstructions from "@/components/WatchInstructions";

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
  const dlHref = `${src}?dl=1`;

  return (
    <main className="mx-auto max-w-md px-4 py-6 pt-16">
      <div className="rounded-2xl overflow-hidden bg-black shadow-2xl shadow-violet-500/10 border border-white/10">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-[9/16] bg-black"
        />
      </div>

      <div className="mt-4 space-y-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
        >
          📱 Guardar en galería
        </a>
        <a
          href={dlHref}
          className="block w-full text-center rounded-lg bg-white/5 border border-white/15 py-3 text-sm text-white/80 hover:bg-white/10"
        >
          ⬇︎ Descargar como fichero
        </a>
      </div>

      <WatchInstructions />

      <div className="mt-6 text-center">
        <Link href="/shorts" className="text-xs text-white/40 hover:text-white/70">
          ← Volver a crear otro Reel
        </Link>
      </div>
    </main>
  );
}
