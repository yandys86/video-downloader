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
import {
  answerCallback,
  editKeyboard,
  sendKeyboard,
  sendMessage,
  type Boton,
} from "@/lib/telegram";
import { callWorkerJson } from "@/lib/workerProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function menuPrincipal(): Boton[][] {
  return [
    [{ text: "🎬 Shorts de un vídeo", callback_data: "m|auto" }],
    [
      { text: "💳 Mis créditos", callback_data: "m|status" },
      { text: "❓ Ayuda", callback_data: "m|help" },
    ],
  ];
}

const TEXTO_MENU =
  "🎬 <b>TuVideoDown</b>\n\n" +
  "Mándame el enlace de un vídeo <b>de tu canal</b> y te saco Shorts, " +
  "los subo y te los programo.";

const TEXTO_AUTO =
  "🔗 <b>Pégame el enlace del vídeo</b>\n\n" +
  "Tiene que ser de un canal tuyo. Sacaré <b>2 Shorts</b> y los programaré " +
  "<b>cada 12 horas</b>, en los huecos de 08:00 y 20:00.\n\n" +
  "<i>Tarda entre 5 y 20 minutos. Te aviso aquí cuando estén.</i>";

const TEXTO_AYUDA =
  "<b>Cómo va esto</b>\n\n" +
  "1. Toca <b>Shorts de un vídeo</b>\n" +
  "2. Pega el enlace de YouTube\n" +
  "3. Confirma\n\n" +
  "Yo analizo el vídeo, escojo los 2 mejores momentos, los monto en vertical " +
  "con subtítulos y los subo <b>privados con fecha</b>: YouTube los publica " +
  "solo a su hora.\n\n" +
  "<code>/menu</code> para volver aquí.";

async function textoCreditos(chatId: number): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { email: true, credits: true, role: true },
  });
  if (!user) return "No estás vinculado. Usa <code>/start CODIGO</code>.";
  const credits = user.role === "admin" ? "∞ (admin)" : String(user.credits);
  return `Cuenta: <code>${user.email}</code>\nCréditos: <b>${credits}</b>`;
}

/** Taps en los botones del menú. */
async function manejarCallback(cb: any): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  const data = String(cb.data || "");
  await answerCallback(cb.id);
  if (!chatId || !msgId) return;

  if (data === "m|main") {
    await editKeyboard(chatId, msgId, TEXTO_MENU, menuPrincipal());
    return;
  }
  if (data === "m|auto") {
    await editKeyboard(chatId, msgId, TEXTO_AUTO, [
      [{ text: "◀ Menú", callback_data: "m|main" }],
    ]);
    return;
  }
  if (data === "m|status") {
    await editKeyboard(chatId, msgId, await textoCreditos(chatId), [
      [{ text: "◀ Menú", callback_data: "m|main" }],
    ]);
    return;
  }
  if (data === "m|help") {
    await editKeyboard(chatId, msgId, TEXTO_AYUDA, [
      [{ text: "◀ Menú", callback_data: "m|main" }],
    ]);
    return;
  }

  // go|<videoId> — confirmado: lanzar
  if (data.startsWith("go|")) {
    const url = `https://www.youtube.com/watch?v=${data.slice(3)}`;
    await editKeyboard(chatId, msgId, "🚀 Lanzado. Te aviso aquí cuando estén.", null);
    try {
      await callWorkerJson("/autoshorts", {
        method: "POST",
        body: JSON.stringify({ url, chat_id: String(chatId), n: 2, cada_horas: 12 }),
      });
    } catch (e: any) {
      await sendMessage(
        chatId,
        `❌ No se pudo lanzar: ${String(e?.message || e).slice(0, 200)}`,
      );
    }
    return;
  }

  // Botón de un menú viejo tras un despliegue: contestar algo, no quedarse mudo.
  await editKeyboard(chatId, msgId, TEXTO_MENU, menuPrincipal());
}

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

  // Taps en botones. OJO: Telegram solo los manda si el webhook se registró
  // con allowed_updates incluyendo "callback_query" — ver scripts/set-webhook.sh.
  // Sin eso los menús se dibujan perfectos y no responden a nada.
  if (update?.callback_query) {
    await manejarCallback(update.callback_query);
    return NextResponse.json({ ok: true });
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

  if (text === "/menu") {
    await sendKeyboard(chatId, TEXTO_MENU, menuPrincipal());
    return NextResponse.json({ ok: true });
  }

  // Un enlace de YouTube suelto: preguntar antes de gastar 15 min de CPU.
  const m = text.match(RE_YOUTUBE);
  if (m) {
    const user = await prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { id: true },
    });
    if (!user) {
      await sendMessage(
        chatId,
        "Primero vincula tu cuenta con <code>/start CODIGO</code>.",
      );
      return NextResponse.json({ ok: true });
    }
    await sendKeyboard(
      chatId,
      `🎬 <b>¿Saco 2 Shorts de este vídeo?</b>\n\n` +
        `<code>${m[0]}</code>\n\n` +
        `Se subirán a tu canal <b>privados con fecha</b>, separados 12 horas.\n\n` +
        `<i>Comprueba que el vídeo es de un canal tuyo: subir material ajeno ` +
        `puede costarte un aviso de copyright.</i>`,
      [
        [{ text: "🚀 Sí, adelante", callback_data: `go|${m[1]}` }],
        [{ text: "✖ No", callback_data: "m|main" }],
      ],
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

  // Cualquier otra cosa: enseñar el menú en vez de una lista de comandos.
  await sendKeyboard(chatId, TEXTO_MENU, menuPrincipal());
  return NextResponse.json({ ok: true });
}
