/**
 * POST /api/paypal/create-order
 * Body: { packId: string }
 * Crea la Purchase (pending) y la orden PayPal. Devuelve { orderID } para el
 * JS SDK del cliente.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PACKS } from "@/lib/pricing";
import { createOrder, isPaypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal no está configurado" }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const pack = PACKS.find((p) => p.id === body.packId);
  if (!pack) return NextResponse.json({ error: "Pack no encontrado" }, { status: 400 });

  // Placeholder providerRefId — lo actualizamos con el orderID al saberlo.
  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      provider: "paypal",
      providerRefId: `pending:${crypto.randomUUID()}`,
      amountCents: pack.priceCents,
      currency: "EUR",
      credits: pack.credits,
      status: "pending",
    },
  });

  try {
    const order = await createOrder({
      amountCents: pack.priceCents,
      currency: "EUR",
      purchaseId: purchase.id,
      description: `TuVideoDown — ${pack.credits} créditos (${pack.label})`,
    });
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { providerRefId: order.id },
    });
    return NextResponse.json({ orderID: order.id });
  } catch (e: any) {
    // Marcar purchase como failed si falló la creación de orden
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "failed" },
    });
    return NextResponse.json({ error: e.message || "PayPal error" }, { status: 502 });
  }
}
