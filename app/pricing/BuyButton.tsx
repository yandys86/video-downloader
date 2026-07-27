"use client";

import { useState } from "react";

export default function BuyButton({ packId, disabled }: { packId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Error al iniciar el pago");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={buy}
        disabled={disabled || loading}
        className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-40"
      >
        {loading ? "Redirigiendo…" : disabled ? "Inicia sesión" : "Comprar"}
      </button>
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
    </>
  );
}
