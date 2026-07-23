/**
 * Cliente HTTP para hablar con el shorts-worker (FastAPI en CT 231).
 * Reenvía el X-Worker-Secret desde env y adjunta el IP del cliente para
 * que el worker aplique rate-limiting por IP real.
 */

export { getClientIp } from "./rateLimit";

const WORKER_URL = (process.env.SHORTS_WORKER_URL || "http://localhost:8000").replace(/\/$/, "");
const WORKER_SECRET = process.env.SHORTS_WORKER_SECRET || "";

export class WorkerError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function callWorker(
  path: string,
  init: RequestInit = {},
  clientIp?: string
): Promise<Response> {
  if (!WORKER_SECRET) {
    throw new WorkerError(500, "SHORTS_WORKER_SECRET no está configurado");
  }
  const headers = new Headers(init.headers);
  headers.set("X-Worker-Secret", WORKER_SECRET);
  if (clientIp) headers.set("X-Client-IP", clientIp);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${WORKER_URL}${path}`, { ...init, headers, cache: "no-store" });
  return res;
}

export async function callWorkerJson<T = unknown>(
  path: string,
  init: RequestInit = {},
  clientIp?: string
): Promise<T> {
  const res = await callWorker(path, init, clientIp);
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.detail || j.error || text;
    } catch {}
    throw new WorkerError(res.status, msg);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}
