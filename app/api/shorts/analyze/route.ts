import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`analyze:${ip}`, 6, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Reintenta en ${rl.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta la URL del vídeo" }, { status: 400 });
    }
    const data = await callWorkerJson<{ job_id: string }>(
      "/analyze",
      { method: "POST", body: JSON.stringify({ url, client_ip: ip }) },
      ip
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
