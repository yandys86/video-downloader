import { NextRequest, NextResponse } from "next/server";
import { callWorker, getClientIp, WorkerError } from "@/lib/workerProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string; idx: string } }
) {
  try {
    const res = await callWorker(
      `/download/${params.jobId}/${params.idx}`,
      {},
      getClientIp(req)
    );
    if (!res.ok || !res.body) {
      const text = await res.text();
      return NextResponse.json({ error: text || "no disponible" }, { status: res.status });
    }
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set(
      "Content-Disposition",
      `attachment; filename="short-${Number(params.idx) + 1}.mp4"`
    );
    const cl = res.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);
    return new NextResponse(res.body, { status: 200, headers });
  } catch (e) {
    const status = e instanceof WorkerError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
