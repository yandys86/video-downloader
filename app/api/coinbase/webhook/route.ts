/**
 * Webhook Coinbase Commerce.
 * Configura en https://beta.commerce.coinbase.com → Settings → Notifications:
 *   URL:   https://tuvideodown.com/api/coinbase/webhook
 *   Shared secret → COINBASE_COMMERCE_WEBHOOK_SECRET
 *
 * Escucha `charge:confirmed` (transacción confirmada on-chain) para acreditar.
 * `charge:pending` = pagó pero aún no hay confirmaciones — no acreditar aún.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret missing" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-cc-webhook-signature") || "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (sig !== expected) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid json" });
  }

  const type: string = event?.event?.type || "";
  const data = event?.event?.data;
  if (!data) return NextResponse.json({ ok: true, ignored: "no data" });

  if (type !== "charge:confirmed") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const chargeId: string = data.id;
  const purchase = await prisma.purchase.findUnique({ where: { providerRefId: chargeId } });
  if (!purchase) return NextResponse.json({ error: "purchase not found" }, { status: 404 });
  if (purchase.status === "paid") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await addCredits(purchase.userId, purchase.credits, "purchase", purchase.id);

  return NextResponse.json({ ok: true, credits: purchase.credits });
}
