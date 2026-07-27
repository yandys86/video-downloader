/**
 * Cliente Stripe singleton para checkout + webhook.
 * STRIPE_SECRET_KEY tiene que estar en el env.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurado");
  _stripe = new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as any,
    typescript: true,
  });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
