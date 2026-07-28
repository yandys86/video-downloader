/**
 * Genera un código de vinculación de 6 caracteres para el user logueado.
 * El código caduca en 15 min. Solo puede haber 1 código pendiente por user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateLinkCode, getBotUsername, isTelegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: "Telegram no está configurado en el servidor" }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

  // Purga códigos caducados de este user
  await prisma.telegramLinkCode.deleteMany({ where: { userId: user.id } });

  // Genera uno nuevo (retry 3x por si hay colisión)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  let code = "";
  for (let i = 0; i < 3; i++) {
    const candidate = generateLinkCode(6);
    try {
      await prisma.telegramLinkCode.create({
        data: { code: candidate, userId: user.id, expiresAt },
      });
      code = candidate;
      break;
    } catch {
      // Colisión — reintentar
    }
  }
  if (!code) {
    return NextResponse.json({ error: "No se pudo generar código, reintenta" }, { status: 500 });
  }

  const botUsername = getBotUsername();
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

  return NextResponse.json({
    code,
    expiresAt: expiresAt.toISOString(),
    botUsername,
    deepLink,
  });
}
