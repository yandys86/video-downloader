/**
 * GET /shorts/output/:jobId/:filename
 *
 * Sirve un MP4 generado por el worker. URL pública (sin sesión) porque llega
 * al usuario por Telegram/email en el fallback de sendVideo cuando el archivo
 * supera el límite (~45 MB). El jobId es un UUID no-adivinable y el filename
 * debe empezar por él, así que actúa como token de acceso.
 *
 * Streaming pass-through desde el worker (que está en red privada).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKER_URL = (process.env.SHORTS_WORKER_URL || "http://localhost:8000").replace(/\/$/, "");
const WORKER_SECRET = process.env.SHORTS_WORKER_SECRET || "";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string; filename: string } },
) {
  const { jobId, filename } = params;
  // Validaciones: filename plano, mp4, y que empiece por jobId (evita usar la
  // URL para pedir ficheros de otros jobs si alguien conoce el nombre).
  if (
    !jobId ||
    !filename ||
    filename.includes("/") ||
    filename.includes("..") ||
    !filename.endsWith(".mp4") ||
    !filename.startsWith(jobId)
  ) {
    return NextResponse.json({ error: "bad filename" }, { status: 400 });
  }
  if (!WORKER_SECRET) {
    return NextResponse.json({ error: "worker no configurado" }, { status: 500 });
  }

  // Query ?dl=1 fuerza descarga (Content-Disposition: attachment).
  // Sin dl (default) va inline → reproducible en el navegador; permite
  // long-press → "Guardar en fotos" en iOS/Android.
  const forceDownload = req.nextUrl.searchParams.get("dl") === "1";
  // Range para permitir seek durante playback
  const range = req.headers.get("range") || undefined;

  const upstream = await fetch(`${WORKER_URL}/files/${encodeURIComponent(filename)}`, {
    headers: {
      "X-Worker-Secret": WORKER_SECRET,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "no encontrado o caducado" },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "video/mp4");
  headers.set(
    "Content-Disposition",
    `${forceDownload ? "attachment" : "inline"}; filename="${filename}"`,
  );
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const crange = upstream.headers.get("content-range");
  if (crange) headers.set("Content-Range", crange);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
