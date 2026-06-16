import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";
import AdSlot from "@/components/AdSlot";
import { AD_SLOT_BOTTOM } from "@/lib/ads";
import { POSTS, getPost } from "@/lib/blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return { title: "Artículo" };
  return { title: post.title, description: post.description };
}

function fmt(date: string): string {
  try {
    return new Date(date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return date;
  }
}

export default function Article({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: "TuVideoDown" },
    publisher: { "@type": "Organization", name: "TuVideoDown" }
  };

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PlatformNav active="/blog" />

      <article>
        <p className="text-xs text-white/40">{fmt(post.date)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white/95">{post.title}</h1>

        <div className="mt-6">
          {post.blocks.map((b, i) =>
            "h2" in b ? (
              <h2 key={i} className="text-xl font-bold text-white/90 mt-7 mb-2">{b.h2}</h2>
            ) : "p" in b ? (
              <p key={i} className="text-white/75 leading-relaxed mt-3">{b.p}</p>
            ) : (
              <ul key={i} className="list-disc pl-5 mt-3 space-y-1 text-white/75">
                {b.ul.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            )
          )}
        </div>
      </article>

      <div className="mt-8">
        <Link href="/" className="inline-block rounded-full border border-violet-400 bg-violet-500/20 px-4 py-2 text-sm text-white hover:bg-violet-500/30">
          ⬇ Ir al descargador
        </Link>
      </div>

      <AdSlot slot={AD_SLOT_BOTTOM} />

      <section className="mt-12">
        <h2 className="text-lg font-bold text-white/90 mb-3">Más guías</h2>
        <ul className="space-y-2">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="text-violet-300 hover:text-violet-200 text-sm">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </main>
  );
}
