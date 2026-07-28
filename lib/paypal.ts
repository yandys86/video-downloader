/**
 * Cliente ligero de PayPal Orders v2 REST. Sin SDK (menos dep).
 * Env:
 *   PAYPAL_CLIENT_ID          (público — se expone también como NEXT_PUBLIC_PAYPAL_CLIENT_ID)
 *   PAYPAL_CLIENT_SECRET      (server-only)
 *   PAYPAL_MODE = "sandbox" | "live"   (default sandbox)
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export function isPaypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalMode(): "sandbox" | "live" {
  return process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
}

function apiBase(): string {
  return paypalMode() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`paypal token ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.access_token as string;
}

export type CreateOrderResult = { id: string; status: string };

export async function createOrder({
  amountCents,
  currency,
  purchaseId,
  description,
}: {
  amountCents: number;
  currency: string;
  purchaseId: string;
  description: string;
}): Promise<CreateOrderResult> {
  const token = await accessToken();
  const amount = (amountCents / 100).toFixed(2);
  const r = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Idempotencia: reintentar con la misma purchaseId no crea otra orden.
      "PayPal-Request-Id": `purchase-${purchaseId}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: purchaseId,
          description,
          amount: { currency_code: currency, value: amount },
        },
      ],
      application_context: {
        brand_name: "TuVideoDown",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`paypal createOrder ${r.status}: ${await r.text()}`);
  return (await r.json()) as CreateOrderResult;
}

export type CaptureResult = {
  id: string;
  status: string;
  purchase_units: Array<{ reference_id?: string }>;
};

export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const token = await accessToken();
  const r = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`paypal capture ${r.status}: ${await r.text()}`);
  return (await r.json()) as CaptureResult;
}

export async function getOrder(orderId: string): Promise<any> {
  const token = await accessToken();
  const r = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`paypal getOrder ${r.status}: ${await r.text()}`);
  return await r.json();
}
