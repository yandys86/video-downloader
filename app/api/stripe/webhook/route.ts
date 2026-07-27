/**
 * Webhook de Stripe: escucha checkout.session.completed y otorga los
 * créditos al user tras el pago exitoso.
 *
 * Configurar en Stripe Dashboard → Developers → Webhooks:
 *   URL: https://tuvideodown.com/api/stripe/webhook
 *   Evento: checkout.session.completed
 *   Signing secret: STRIPE_WEBHOOK_SECRET en el .env
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  }
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `bad signature: ${err.message}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits || 0);
  const purchaseId = session.metadata?.purchaseId;
  if (!userId || !credits) {
    return NextResponse.json({ error: "missing metadata" }, { status: 400 });
  }

  // Idempotencia: si ya está paid, no repetimos
  const purchase = purchaseId
    ? await prisma.purchase.findUnique({ where: { id: purchaseId } })
    : await prisma.purchase.findUnique({ where: { providerRefId: session.id } });

  if (!purchase) {
    return NextResponse.json({ error: "purchase not found" }, { status: 404 });
  }
  if (purchase.status === "paid") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await addCredits(userId, credits, "purchase", purchase.id);

  return NextResponse.json({ ok: true, credits });
}
