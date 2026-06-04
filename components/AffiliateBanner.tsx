import {
  AFFILIATE_VPN_CTA,
  AFFILIATE_VPN_LABEL,
  AFFILIATE_VPN_URL
} from "@/lib/ads";

export default function AffiliateBanner() {
  return (
    <a
      href={AFFILIATE_VPN_URL}
      target="_blank"
      rel="sponsored nofollow noopener"
      className="mb-6 block rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3 text-sm hover:border-amber-400/60 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-amber-100/90">{AFFILIATE_VPN_LABEL}</span>
        <span className="rounded-full bg-amber-400 text-black font-semibold px-3 py-1 text-xs whitespace-nowrap">
          {AFFILIATE_VPN_CTA}
        </span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-200/40">
        Anuncio · enlace de afiliado
      </div>
    </a>
  );
}
