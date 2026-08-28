/**
 * Helpers Telegram — solo mensajes (el envío de vídeos lo hace el worker
 * Python que ya tiene los MP4s en disco).
 */

const API_BASE = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export function getBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}

export async function sendMessage(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type Boton = { text: string; callback_data: string };

/** Manda un mensaje con botones inline. */
export async function sendKeyboard(
  chatId: string | number,
  text: string,
  buttons: Boton[][],
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reemplaza el mensaje del botón en vez de mandar uno nuevo: si no, el chat se
 * llena de menús viejos que ya no valen y que se tocan por error.
 */
export async function editKeyboard(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons: Boton[][] | null,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Apaga el "cargando" del botón. Su fallo no importa: nunca debe bloquear. */
export async function answerCallback(id: string, text = ""): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${API_BASE}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: id, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* da igual */
  }
}

/**
 * Genera un código de vinculación de 6 caracteres alfanuméricos (mayúsculas + dígitos)
 * suficientemente único para pocos usuarios y fácil de teclear en móvil.
 */
export function generateLinkCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/I/1 para evitar confusión
  const buf = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
