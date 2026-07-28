"use client";

import { useState } from "react";

export default function CryptoButton({ packId, disabled }: { packId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/coinbase/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Error");
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
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/15 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40"
      >
        <span aria-hidden>₿</span>
        {loading ? "Abriendo…" : "Pagar en cripto"}
      </button>
      {error && <div className="mt-1 text-xs text-red-300">{error}</div>}
    </>
  );
}
