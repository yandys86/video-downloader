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
    // Calcular duración final (start+duration o start→end)
    const start = Number(body.start ?? 0);
    const durSec = body.end !== undefined
      ? Number(body.end) - start
      : Number(body.duration ?? 30);
    const cost = reelDurationToCredits(durSec);

    const charge = await deductCredits(user.id, cost, "reel_quick_clip");
    if (!charge.ok) {
      return NextResponse.json(
        {
          error: `Necesitas ${cost} créditos para este Reel. Balance: ${charge.balance}.`,
          creditsRequired: cost,
          creditsAvailable: charge.balance,
          buyUrl: "/pricing",
        },
        { status: 402 },  // Payment Required
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { telegramChatId: true, emailNotifications: true, email: true },
    });

    const data = await callWorkerJson<{ job_id: string }>(
      "/quick_clip",
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
    return NextResponse.json({ ...data, creditsCharged: cost });
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
