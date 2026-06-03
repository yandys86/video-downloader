import AdSlot from "@/components/AdSlot";
import AffiliateBanner from "@/components/AffiliateBanner";
import Downloader from "@/components/Downloader";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";
import { AD_SLOT_BOTTOM, AD_SLOT_TOP } from "@/lib/ads";

const FAQ = [
  {
    q: "Como descargo un video?",
    a: "Copia el enlace del video, pegalo en el campo, elegi la calidad (o solo audio) y toca Descargar al dispositivo. El archivo se guarda en la carpeta de descargas de tu navegador."
  },
  {
    q: "Funciona en iPhone y Android?",
    a: "Si. La descarga viaja desde el servidor al navegador como un archivo MP4 estandar, asi que tu telefono lo guarda en su carpeta de descargas sin instalar nada."
  },
  {
    q: "Es gratis?",
    a: "Si, el servicio es totalmente gratuito. No tenes que registrarte ni instalar extensiones."
  },
  {
    q: "Que plataformas soporta?",
    a: "YouTube, YouTube Shorts, TikTok, Instagram (Reels y posts publicos), Twitter/X y Facebook (incluyendo FB Watch)."
  },
  {
    q: "Puedo descargar videos privados o de cuentas con login?",
    a: "No. Solo funciona con videos publicos. Cuentas privadas, stories de Instagram o paginas con login obligatorio no se pueden bajar."
  }
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a }
  }))
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
          <span className="size-2 rounded-full bg-green-400 animate-pulse" />
          Descarga directo al dispositivo
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Descarga videos de YouTube, TikTok, Instagram, X y Facebook
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">
          Pega el enlace, elegi la calidad y descarga al instante. Gratis, sin instalar nada,
          sin marca de agua en TikTok.
        </p>
      </header>

      <PlatformNav active="/" />

      <AffiliateBanner />

      <Downloader />

      <AdSlot slot={AD_SLOT_TOP} />

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
