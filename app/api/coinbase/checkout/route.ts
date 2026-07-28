/**
 * POST /api/coinbase/checkout
 * Body: { packId }
 * Crea Purchase (pending) + Coinbase Commerce charge y devuelve la hosted URL
 * para que el user pague en cripto.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PACKS } from "@/lib/pricing";
import { createCharge, isCoinbaseConfigured } from "@/lib/coinbase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isCoinbaseConfigured()) {
    return NextResponse.json({ error: "Cripto no está configurado" }, { status: 503 });
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

  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      provider: "crypto",
      providerRefId: `pending:${crypto.randomUUID()}`,
      amountCents: pack.priceCents,
      currency: "EUR",
      credits: pack.credits,
      status: "pending",
    },
  });

  try {
    const ch = await createCharge({
      amountCents: pack.priceCents,
      currency: "EUR",
      name: "TuVideoDown créditos",
      description: `${pack.credits} créditos (${pack.label})`,
      metadata: {
        userId: user.id,
        purchaseId: purchase.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
    });
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { providerRefId: ch.id },
    });
    return NextResponse.json({ url: ch.hosted_url, chargeId: ch.id });
  } catch (e: any) {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "failed" },
    });
    return NextResponse.json({ error: e.message || "Coinbase error" }, { status: 502 });
  }
}
