/**
 * Coinbase Commerce Charges API — pagos en cripto (BTC, ETH, USDC, LTC, DAI, etc).
 * Env:
 *   COINBASE_COMMERCE_API_KEY     (server-only)
 *   COINBASE_COMMERCE_WEBHOOK_SECRET (shared secret para verificar HMAC)
 * https://docs.cdp.coinbase.com/commerce-onchain/reference
 */

const API_BASE = "https://api.commerce.coinbase.com";

export function isCoinbaseConfigured(): boolean {
  return !!process.env.COINBASE_COMMERCE_API_KEY;
}

export type CoinbaseCharge = {
  id: string;
  code: string;
  hosted_url: string;
  metadata?: Record<string, string>;
  timeline: Array<{ status: string; time: string }>;
};

export async function createCharge({
  amountCents,
  currency,
  name,
  description,
  metadata,
}: {
  amountCents: number;
  currency: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
}): Promise<CoinbaseCharge> {
  const key = process.env.COINBASE_COMMERCE_API_KEY!;
  const amount = (amountCents / 100).toFixed(2);
  const r = await fetch(`${API_BASE}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": key,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name,
      description,
      pricing_type: "fixed_price",
      local_price: { amount, currency },
      metadata,
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`coinbase createCharge ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data as CoinbaseCharge;
}
