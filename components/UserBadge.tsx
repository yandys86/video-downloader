"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

/** Barra fija arriba a la derecha con estado de sesión + créditos. */
export default function UserBadge() {
  const { data: session, status, update } = useSession();

  // El JWT solo se refresca cuando explícitamente llamamos update(); si no,
  // tras una compra Stripe el topbar seguiría mostrando el saldo viejo. Lo
  // forzamos al montar y cada vez que la pestaña vuelve a foco.
  useEffect(() => {
    if (status !== "authenticated") return;
    update();
    const onVis = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "loading") {
    return <div className="text-xs text-white/40">…</div>;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="rounded-full border border-white/15 px-3 py-1 text-white/80 hover:border-white/30 hover:text-white">
          Entrar
        </Link>
        <Link href="/register" className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-1 font-medium text-white shadow">
          Crear cuenta
        </Link>
      </div>
    );
  }

  const u = session.user;
  return (
    <div className="flex items-center gap-2 text-sm">
      {u.role === "admin" && (
        <Link
          href="/admin"
          className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-xs text-amber-200 hover:bg-amber-500/30"
          title="Panel admin"
        >
          admin
        </Link>
      )}
      <Link
        href="/account"
        title={u.email || ""}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-white/80 hover:border-white/30"
      >
        <span className="text-fuchsia-300">✦</span>
        <span className="font-semibold text-white">
          {u.role === "admin" ? "∞" : u.credits}
        </span>
        <span className="text-white/50">créditos</span>
      </Link>
      <Link
        href="/shorts"
        className="hidden sm:inline rounded-full bg-white/[0.03] border border-white/15 px-3 py-1 text-white/70 hover:border-white/30 hover:text-white"
      >
        Reels
      </Link>
      <Link
        href="/pricing"
        className="hidden sm:inline rounded-full bg-white/[0.03] border border-white/15 px-3 py-1 text-white/70 hover:border-white/30 hover:text-white"
      >
        Comprar
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-xs text-white/40 hover:text-white/70"
        title="Cerrar sesión"
      >
        ⏻
      </button>
    </div>
  );
}
