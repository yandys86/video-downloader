import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit configurable por env: SHORTS_MAX_PER_DAY (0 = desactivado).
// El worker aplica su propio límite adicionalmente.
const SHORTS_MAX_PER_DAY = Number(process.env.SHORTS_MAX_PER_DAY ?? 1000);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (SHORTS_MAX_PER_DAY > 0) {
    const rl = checkRateLimit(`generate:${ip}`, SHORTS_MAX_PER_DAY, 24 * 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Has alcanzado el límite diario de Shorts. Vuelve en ${Math.ceil(rl.retryAfter / 3600)}h.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
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
