import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { PACKS, fmtPrice } from "@/lib/pricing";
import BuyButton from "./BuyButton";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Añade créditos a tu cuenta
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">
          1 crédito ≈ 15 segundos de Reel. Sin planes mensuales. Los créditos no caducan.
        </p>
      </header>

      {!session && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="font-medium">Debes iniciar sesión antes de comprar.</div>
          <Link href="/login?callbackUrl=/pricing" className="mt-2 inline-block rounded bg-white/10 px-3 py-1 text-white hover:bg-white/20">
            Entrar / Crear cuenta
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PACKS.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl border p-5 ${
              p.featured
                ? "border-fuchsia-400 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            {p.featured && (
              <span className="absolute -top-2 left-4 rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-semibold text-white">
                Más popular
              </span>
            )}
            <div className="text-sm font-medium text-white/60">{p.label}</div>
            <div className="mt-1 text-3xl font-bold text-white">
              {p.credits} <span className="text-base font-normal text-white/60">créditos</span>
            </div>
            <div className="mt-2 text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 to-violet-300">
              {fmtPrice(p.priceCents)}
            </div>
            {p.hint && <div className="mt-1 text-xs text-white/50">{p.hint}</div>}
            <div className="mt-4">
              <BuyButton packId={p.id} disabled={!session} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/70">
        <h3 className="mb-2 font-semibold text-white">¿Cómo consumen los créditos?</h3>
        <ul className="space-y-1">
          <li>• Reel de 15 segundos → <strong>1 crédito</strong></li>
          <li>• Reel de 30 segundos → <strong>2 créditos</strong></li>
          <li>• Reel de 45 segundos → <strong>3 créditos</strong></li>
          <li>• Reel de 60 segundos → <strong>4 créditos</strong></li>
          <li>• Análisis del vídeo con IA (detectar highlights) → gratis</li>
        </ul>
        <p className="mt-3 text-white/50">
          Métodos de pago: tarjeta (Stripe). PayPal y cripto próximamente.
        </p>
      </div>
    </main>
  );
}
