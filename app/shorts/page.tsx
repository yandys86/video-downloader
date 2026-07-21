import type { Metadata } from "next";
import AdSlot from "@/components/AdSlot";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";
import ShortsGenerator from "@/components/ShortsGenerator";
import { AD_SLOT_BOTTOM, AD_SLOT_TOP } from "@/lib/ads";

export const metadata: Metadata = {
  title: "Generador de YouTube Shorts gratis — TuVideoDown",
  description:
    "Convierte cualquier vídeo largo de YouTube en Shorts virales (9:16, con captions y voz IA) automáticamente. Gratis, sin registro, sin marca de agua.",
  alternates: { canonical: "/shorts" },
  openGraph: {
    title: "Generador de YouTube Shorts gratis",
    description:
      "Pega la URL de un vídeo largo y en minutos obtienes Shorts listos para subir a YouTube, TikTok y Reels.",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Cómo funciona el generador de Shorts?",
    a: "Pegas la URL de un vídeo largo de YouTube, la app lo descarga, lo transcribe con IA (Whisper), detecta los momentos con más potencial viral, reescribe cada uno como guion punchy y monta un MP4 vertical 9:16 con voz IA y captions estilo karaoke.",
  },
  {
    q: "¿Cuánto tarda?",
    a: "Entre 30 segundos y 3 minutos según la duración del vídeo original. Puedes cerrar la pestaña cuando estén listos (verás el enlace de descarga).",
  },
  {
    q: "¿Es gratis?",
    a: "Sí. Hay un límite de 3 Shorts por día y por IP para evitar abuso. Si necesitas más, contáctanos.",
  },
  {
    q: "¿Qué duración máxima puede tener el vídeo largo?",
    a: "20 minutos. Si necesitas procesar vídeos más largos, córtalo antes o contáctanos para una cuenta con límites mayores.",
  },
  {
    q: "¿Los Shorts salen listos para subir?",
    a: "Sí. MP4 1080×1920 (9:16), captions incrustadas, voz IA neural natural en español. Puedes descargar cada Short y subirlo directamente a YouTube Shorts, TikTok o Instagram Reels.",
  },
  {
    q: "¿Qué idiomas soporta?",
    a: "El detector de idioma es automático (Whisper). La voz IA por defecto es española (España o México). Otros idiomas próximamente.",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-4">
          <span className="size-2 rounded-full bg-fuchsia-400 animate-pulse" />
          Beta gratis · 3 Shorts / día
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Convierte vídeos largos en Shorts virales
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">
          Pega la URL de un vídeo de YouTube y obtén automáticamente Shorts 9:16 con voz IA
          y captions karaoke, listos para subir a YouTube Shorts, TikTok y Reels.
        </p>
      </header>

      <PlatformNav active="/shorts" />

      <ShortsGenerator />

      <AdSlot slot={AD_SLOT_TOP} />

      <section className="mt-12 space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">Cómo funciona</h2>
        <ol className="space-y-3 text-white/80">
          <li className="flex gap-3">
            <span className="shrink-0 grid size-7 place-items-center rounded-full bg-violet-500/20 border border-violet-400 text-sm font-bold">1</span>
            <span><strong>Pega la URL</strong> de un vídeo largo de YouTube (podcast, tutorial, charla…).</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 grid size-7 place-items-center rounded-full bg-violet-500/20 border border-violet-400 text-sm font-bold">2</span>
            <span><strong>Elige los momentos</strong> que la IA detecta como más virales.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 grid size-7 place-items-center rounded-full bg-violet-500/20 border border-violet-400 text-sm font-bold">3</span>
            <span><strong>Descarga los Shorts</strong> montados con voz IA + captions listos para subir.</span>
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Qué obtienes</h2>
        <ul className="grid grid-cols-2 gap-2 text-white/80">
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">MP4 vertical 1080×1920</li>
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Captions estilo karaoke</li>
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Voz IA neural natural</li>
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Sin marca de agua</li>
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Guion punchy reescrito</li>
          <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Listo para subir</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Preguntas frecuentes</h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <summary className="cursor-pointer font-medium text-white/90 list-none flex items-center justify-between">
                <span>{q}</span>
                <span className="text-white/40 group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-2 text-sm text-white/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <AdSlot slot={AD_SLOT_BOTTOM} />

      <Footer />
    </main>
  );
}
