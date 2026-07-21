import { NextRequest, NextResponse } from "next/server";
import { callWorkerJson, getClientIp, WorkerError } from "@/lib/workerProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await callWorkerJson(`/jobs/${params.id}`, {}, getClientIp(req));
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
