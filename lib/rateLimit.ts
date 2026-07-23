/**
 * Rate limit + helpers de IP compartidos por todas las rutas API.
 * Frena bots y usuarios abusivos antes de tocar yt-dlp/ffmpeg/worker.
 *
 * En producción con múltiples instancias sustituir por Redis/Upstash.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  if (!ip) return { ok: true, retryAfter: 0 };
  const now = Date.now();
  const b = store.get(ip);
  if (!b || b.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Extrae el IP real del cliente. Prioriza cabecera de Cloudflare, luego
 * X-Forwarded-For, y por último cae al hostname del socket.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "";
}

// Cleanup ocasional (no crítico si no corre).
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of store) if (b.resetAt <= now) store.delete(ip);
}, 60_000).unref?.();
