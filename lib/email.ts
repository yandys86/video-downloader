/**
 * Envío de emails vía Resend HTTP API (sin SDK — llamada directa a fetch).
 * Free tier: 100 emails/día, 3000/mes.
 *
 * El envío de "Reel listo" lo hace el worker Python directamente (más simple:
 * el worker ya tiene el MP4). Este módulo queda para otros correos (verificación,
 * reset password, avisos manuales del admin, etc.).
 */

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text: text || subject,
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
