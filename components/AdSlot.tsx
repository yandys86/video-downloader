"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export default function AdSlot({ slot, className = "" }: { slot?: string; className?: string }) {
  const ref = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!slot || !ref.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle script not loaded yet or duplicate push — ignore
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <div className={`my-6 ${className}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1 text-center">
        Anuncio
      </div>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
