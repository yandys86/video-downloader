import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`generate:${ip}`, 3, 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Has alcanzado el límite diario de Shorts. Vuelve en ${Math.ceil(rl.retryAfter / 3600)}h.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const body = await req.json();
    const data = await callWorkerJson<{ job_id: string }>(
      "/generate",
      { method: "POST", body: JSON.stringify({ ...body, client_ip: ip }) },
      ip
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
