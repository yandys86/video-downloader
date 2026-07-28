/**
 * POST /api/paypal/capture-order
 * Body: { orderID: string }
 * Captura el pago en PayPal y otorga créditos. Idempotente.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addCredits } from "@/lib/credits";
import { captureOrder, isPaypalConfigured } from "@/lib/paypal";

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
  const orderID: string = String(body.orderID || "");
  if (!orderID) return NextResponse.json({ error: "orderID requerido" }, { status: 400 });

  const purchase = await prisma.purchase.findUnique({ where: { providerRefId: orderID } });
  if (!purchase) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  if (purchase.userId !== user.id) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (purchase.status === "paid") {
    return NextResponse.json({ ok: true, alreadyProcessed: true, credits: purchase.credits });
  }

  try {
    const cap = await captureOrder(orderID);
    if (cap.status !== "COMPLETED") {
      return NextResponse.json({ error: `PayPal status: ${cap.status}` }, { status: 402 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "capture failed" }, { status: 502 });
  }

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await addCredits(purchase.userId, purchase.credits, "purchase", purchase.id);

  return NextResponse.json({ ok: true, credits: purchase.credits });
}
