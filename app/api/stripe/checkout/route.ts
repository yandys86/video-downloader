/**
 * Crea una Checkout Session de Stripe para comprar un pack de créditos.
 * El usuario debe estar autenticado. Al pagar, el webhook otorga los créditos.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getPack } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Los pagos aún no están activos. Contacta al admin." },
      { status: 503 },
    );
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  }
  const { packId } = await req.json();
  const pack = getPack(String(packId));
  if (!pack) return NextResponse.json({ error: "Pack no válido" }, { status: 400 });

  // Registro pending; se actualiza a paid en el webhook
  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      provider: "stripe",
      providerRefId: `pending-${Date.now()}-${user.id}`,
      amountCents: pack.priceCents,
      currency: "EUR",
      credits: pack.credits,
      status: "pending",
    },
  });

  const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "tuvideodown.com"}`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email || undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Pack ${pack.label} — ${pack.credits} créditos`,
            description: pack.hint,
          },
          unit_amount: pack.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      packId: pack.id,
      credits: String(pack.credits),
      purchaseId: purchase.id,
    },
    success_url: `${origin}/account?paid=1&pack=${pack.id}`,
    cancel_url: `${origin}/pricing?cancelled=1`,
  });

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { providerRefId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
