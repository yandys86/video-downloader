/**
 * Rate limit muy simple en memoria por IP. Sirve para frenar bots que
 * intenten disparar analyze/generate en bucle. El límite duro (3 Shorts/día)
 * lo aplica también el worker en la BBDD, esto es solo cortafuegos rápido.
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

// Cleanup ocasional (no crítico si no corre).
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of store) if (b.resetAt <= now) store.delete(ip);
}, 60_000).unref?.();
