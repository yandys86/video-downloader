import AdSlot from "@/components/AdSlot";
import AffiliateBanner from "@/components/AffiliateBanner";
import Downloader from "@/components/Downloader";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";
import { AD_SLOT_BOTTOM, AD_SLOT_TOP } from "@/lib/ads";

export type FaqItem = { q: string; a: string };

type Props = {
  navActive: string;
  badge: string;
  heading: string;
  intro: string;
  placeholder: string;
  highlights: string[];
  faq: FaqItem[];
};

function faqJsonLd(faq: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a }
    }))
  };
}

export default function PlatformLanding({
  navActive,
  badge,
  heading,
  intro,
  placeholder,
  highlights,
  faq
}: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }}
      />

      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-4">
          <span className="size-2 rounded-full bg-green-400 animate-pulse" />
          {badge}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          {heading}
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">{intro}</p>
      </header>

      <PlatformNav active={navActive} />

      <AffiliateBanner />

      <Downloader placeholder={placeholder} />

      <AdSlot slot={AD_SLOT_TOP} />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Caracteristicas</h2>
        <ul className="space-y-2 text-white/80">
          {highlights.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-violet-300">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Preguntas frecuentes</h2>
        <div className="space-y-3">
          {faq.map(({ q, a }) => (
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
