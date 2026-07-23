/**
 * Cache LRU en memoria con TTL para respuestas de /api/info.
 * Evita re-invocar `yt-dlp --dump-json` en spam de la misma URL.
 *
 * En producción con múltiples instancias sustituir por Redis.
 */

type Entry<V> = { value: V; expiresAt: number };

class TtlCache<V> {
  private store = new Map<string, Entry<V>>();

  constructor(
    private readonly maxEntries = 200,
    private readonly ttlMs = 10 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // LRU: mover al final del Map (que preserva orden de inserción).
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const first = this.store.keys().next().value;
      if (first === undefined) break;
      this.store.delete(first);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// 200 URLs cacheadas · 10 min TTL. RAM despreciable (<1 MB).
export const infoCache = new TtlCache<Record<string, unknown>>(
  200,
  10 * 60 * 1000,
);
