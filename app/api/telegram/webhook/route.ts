/**
 * Recibe updates de Telegram Bot API. Solo procesa /start CODE para vincular
 * la cuenta del user con su chat_id.
 *
 * Configurar el webhook una sola vez con:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tuvideodown.com/api/telegram/webhook&secret_token=<SECRET>"
 *
 * secret_token opcional (TELEGRAM_WEBHOOK_SECRET) — Telegram lo envía en el
 * header X-Telegram-Bot-Api-Secret-Token. Si está configurado lo verificamos.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Verificación opcional del secret
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignorar malformed
  }

  const msg = update?.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId: number | undefined = msg.chat?.id;
  const text: string = String(msg.text || "").trim();

  if (!chatId) return NextResponse.json({ ok: true });

  // Handlers de comandos
  if (text.startsWith("/start")) {
    const code = text.slice(6).trim().toUpperCase();
    if (!code) {
      await sendMessage(
        chatId,
        "¡Hola! Soy el bot de <b>TuVideoDown</b>. Para vincular tu cuenta:\n\n" +
          "1. Entra a https://tuvideodown.com/account\n" +
          "2. Genera un código de vinculación\n" +
          "3. Envíamelo con <code>/start CODIGO</code>",
      );
      return NextResponse.json({ ok: true });
    }

    // Buscar el código
    const link = await prisma.telegramLinkCode.findUnique({ where: { code } });
    if (!link || link.expiresAt < new Date()) {
      await sendMessage(chatId, "❌ Código no válido o caducado. Genera uno nuevo en tuvideodown.com/account");
      if (link) await prisma.telegramLinkCode.delete({ where: { code } }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // Vincular
    await prisma.$transaction([
      prisma.user.update({
        where: { id: link.userId },
        data: { telegramChatId: String(chatId) },
      }),
      prisma.telegramLinkCode.delete({ where: { code } }),
    ]);

    await sendMessage(
      chatId,
      "✅ ¡Cuenta vinculada!\n\nCuando termines de generar un Reel, te lo enviaré aquí directamente. " +
        "Usa <code>/status</code> para ver tus créditos o <code>/unlink</code> para desvincular.",
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/status") {
    const user = await prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { email: true, credits: true, role: true },
    });
    if (!user) {
      await sendMessage(chatId, "No estás vinculado. Usa /start CODIGO para vincular tu cuenta.");
    } else {
      const credits = user.role === "admin" ? "∞ (admin)" : String(user.credits);
      await sendMessage(chatId, `Cuenta: <code>${user.email}</code>\nCréditos: <b>${credits}</b>`);
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/unlink") {
    await prisma.user.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { telegramChatId: null },
    });
    await sendMessage(chatId, "🔌 Cuenta desvinculada. Ya no recibirás Reels aquí. Puedes volver a vincular en tuvideodown.com/account.");
    return NextResponse.json({ ok: true });
  }

  // Comando desconocido
  await sendMessage(
    chatId,
    "Comandos disponibles:\n" +
      "<code>/start CODIGO</code> — vincular cuenta\n" +
      "<code>/status</code> — ver créditos\n" +
      "<code>/unlink</code> — desvincular",
  );
  return NextResponse.json({ ok: true });
}
