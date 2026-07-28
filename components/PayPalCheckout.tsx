"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Renderiza los Smart Buttons de PayPal para un pack concreto.
 * Requiere NEXT_PUBLIC_PAYPAL_CLIENT_ID en el build de Next.js.
 * Carga el SDK una sola vez y monta un botón nuevo por instancia.
 */

let sdkPromise: Promise<any> | null = null;

function loadSdk(clientId: string, currency = "EUR"): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if ((window as any).paypal) return Promise.resolve((window as any).paypal);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId,
    )}&currency=${currency}&intent=capture&disable-funding=credit,card`;
    s.async = true;
    s.onload = () => resolve((window as any).paypal);
    s.onerror = () => reject(new Error("No se pudo cargar el SDK de PayPal"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

type Props = { packId: string; disabled?: boolean };

export default function PayPalCheckout({ packId, disabled }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled) return;
    let cancelled = false;
    loadSdk(clientId)
      .then((paypal) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = ""; // limpiar renders anteriores
        paypal
          .Buttons({
            style: { layout: "horizontal", color: "gold", shape: "rect", label: "paypal", tagline: false, height: 40 },
            createOrder: async () => {
              setError(null);
              const r = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ packId }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || "Error creando orden");
              return data.orderID as string;
            },
            onApprove: async (data: any) => {
              const r = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderID: data.orderID }),
              });
              const res = await r.json();
              if (!r.ok) {
                setError(res.error || "Error capturando pago");
                return;
              }
              router.push(`/account?paid=1&provider=paypal`);
            },
            onError: (err: any) => {
              setError(String(err?.message || err));
            },
            onCancel: () => {
              // Silencio; el user simplemente cerró el popup
            },
          })
          .render(ref.current)
          .then(() => setReady(true))
          .catch((e: any) => setError(e.message));
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, packId, disabled, router]);

  if (!clientId) return null;
  return (
    <div className="mt-2">
      <div ref={ref} className={disabled ? "opacity-40 pointer-events-none" : ""} />
      {!ready && !error && <div className="text-xs text-white/40 py-2">Cargando PayPal…</div>}
      {error && <div className="mt-1 text-xs text-red-300">{error}</div>}
    </div>
  );
}
