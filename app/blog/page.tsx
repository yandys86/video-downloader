import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";
import { POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Guías y blog para descargar videos",
  description:
    "Tutoriales y consejos para descargar videos de redes sociales: calidad, formatos, sin marca de agua y uso responsable."
};

function fmt(date: string): string {
  try {
    return new Date(date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return date;
  }
}

export default function Blog() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Guías y consejos
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">
          Tutoriales prácticos para descargar y guardar tus videos favoritos con la mejor calidad y de forma segura.
        </p>
      </header>

      <PlatformNav active="/blog" />

      <ul className="space-y-4">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 hover:border-white/20 transition"
            >
              <div className="text-xs text-white/40">{fmt(p.date)}</div>
              <h2 className="mt-1 text-lg font-semibold text-white/90">{p.title}</h2>
              <p className="mt-1 text-sm text-white/65">{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Footer />
    </main>
  );
}
