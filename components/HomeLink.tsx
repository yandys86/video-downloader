"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Enlace fijo arriba a la izquierda a la home. Se oculta en la propia home
 * para no duplicar branding. Da un ancla de navegación consistente en /account,
 * /pricing, /shorts, etc.
 */
export default function HomeLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link
      href="/"
      title="Volver al inicio"
      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-sm text-white/80 hover:border-white/30 hover:text-white"
    >
      <span aria-hidden>←</span>
      <span className="font-semibold">TuVideoDown</span>
    </Link>
  );
}
