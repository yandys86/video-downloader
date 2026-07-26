import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  try {
    const body = await req.json();
    const data = await callWorkerJson(
      "/push/subscribe",
      { method: "POST", body: JSON.stringify({ ...body, client_ip: ip }) },
      ip
    );
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
