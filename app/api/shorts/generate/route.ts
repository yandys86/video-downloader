import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";
import { deductCredits, reelDurationToCredits } from "@/lib/credits";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para generar Reels." },
      { status: 401 },
    );
  }
  try {
    const body = await req.json();
    // Cost = N Reels × créditos por Reel según clip_duration (o 30s si auto).
    const durationPerReel = Number(body.clip_duration ?? 30);
    const perReelCost = reelDurationToCredits(durationPerReel);
    const nReels = Math.max(
      1,
      (body.highlight_indices?.length || 0) + (body.custom_ranges?.length || 0),
    );
    const totalCost = perReelCost * nReels;

    const charge = await deductCredits(user.id, totalCost, "reel_generate");
    if (!charge.ok) {
      return NextResponse.json(
        {
          error: `Necesitas ${totalCost} créditos (${nReels} Reels × ${perReelCost}). Balance: ${charge.balance}.`,
          creditsRequired: totalCost,
          creditsAvailable: charge.balance,
          buyUrl: "/pricing",
        },
        { status: 402 },
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { telegramChatId: true, emailNotifications: true, email: true },
    });

    const data = await callWorkerJson<{ job_id: string }>(
      "/generate",
      {
        method: "POST",
        body: JSON.stringify({
          ...body,
          client_ip: ip,
          notify_telegram_chat_id: dbUser?.telegramChatId || undefined,
          notify_email: dbUser?.emailNotifications ? dbUser.email : undefined,
        }),
      },
      ip
    );
    return NextResponse.json({ ...data, creditsCharged: totalCost });
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
