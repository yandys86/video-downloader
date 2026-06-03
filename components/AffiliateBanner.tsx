const AFFILIATE_URL = process.env.NEXT_PUBLIC_AFFILIATE_VPN_URL;
const AFFILIATE_LABEL =
  process.env.NEXT_PUBLIC_AFFILIATE_VPN_LABEL ||
  "Protege tus descargas con una VPN — oferta limitada";
const AFFILIATE_CTA =
  process.env.NEXT_PUBLIC_AFFILIATE_VPN_CTA || "Ver oferta";

export default function AffiliateBanner() {
  if (!AFFILIATE_URL) return null;
  return (
    <a
      href={AFFILIATE_URL}
      target="_blank"
      rel="sponsored nofollow noopener"
      className="mb-6 block rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3 text-sm hover:border-amber-400/60 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-amber-100/90">{AFFILIATE_LABEL}</span>
        <span className="rounded-full bg-amber-400 text-black font-semibold px-3 py-1 text-xs whitespace-nowrap">
          {AFFILIATE_CTA}
        </span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-200/40">
        Anuncio · enlace de afiliado
      </div>
    </a>
  );
}
