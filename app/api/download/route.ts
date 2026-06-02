import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import youtubedl from "youtube-dl-exec";
import { detectPlatform, isSupportedUrl, safeFilename } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const YT_DLP_BIN: string =
  (youtubedl as any).binaryPath ||
  process.env.YT_DLP_PATH ||
  "yt-dlp";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function buildFormatSelector(quality: string | null): string {
  switch (quality) {
    case "audio":
      return "bestaudio[ext=m4a]/bestaudio";
    case "360":
      return "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]";
    case "480":
      return "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]";
    case "720":
      return "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]";
    case "1080":
      return "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]";
    case "best":
    default:
      return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
  }
}

function buildContentDisposition(filename: string): string {
  const safe = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${safe}"`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const quality = searchParams.get("quality");
  const titleHint = searchParams.get("title") || "video";

  if (!url || !isSupportedUrl(url)) {
    return new Response(JSON.stringify({ error: "URL no soportada" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const isAudio = quality === "audio";
  const ext = isAudio ? "m4a" : "mp4";
  const filename = safeFilename(titleHint, ext);
  const platform = detectPlatform(url);

  const args = [
    url,
    "-f", buildFormatSelector(quality),
    "-o", "-",
    "--no-warnings",
    "--no-playlist",
    "--no-progress",
    "--no-check-certificates",
    "--user-agent", USER_AGENT,
    "--add-header", "Accept-Language:en-US,en;q=0.9"
  ];

  if (!isAudio) {
    args.push("--merge-output-format", "mp4");
  } else {
    args.push("-x", "--audio-format", "m4a");
  }

  const child = spawn(YT_DLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });

  let stderrBuf = "";
  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
    if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-4000);
  });

  const firstChunk = await new Promise<Buffer | null>((resolve) => {
    let done = false;
    const finish = (v: Buffer | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    child.stdout.once("data", (chunk: Buffer) => finish(chunk));
    child.on("close", () => finish(null));
    child.on("error", () => finish(null));
    setTimeout(() => finish(null), 45000);
  });

  if (!firstChunk) {
    try { child.kill("SIGTERM"); } catch {}
    const detail = stderrBuf.slice(-1500).trim();
    return new Response(
      JSON.stringify({
        error: "yt-dlp no pudo descargar este video",
        hint: "La plataforma puede requerir autenticacion, el video puede estar privado/geo-bloqueado, o el formato pedido no esta disponible.",
        detail
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      }
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(firstChunk);
      child.stdout.on("data", (chunk) => controller.enqueue(chunk));
      child.stdout.on("end", () => controller.close());
      child.stdout.on("error", (err) => controller.error(err));
      child.on("error", (err) => controller.error(err));
      child.on("close", (code) => {
        if (code !== 0) {
          try { controller.error(new Error(stderrBuf || `yt-dlp exit ${code}`)); } catch {}
        }
      });
    },
    cancel() {
      try { child.kill("SIGTERM"); } catch {}
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": isAudio ? "audio/mp4" : "video/mp4",
      "Content-Disposition": buildContentDisposition(filename),
      "Cache-Control": "no-store",
      "X-Platform": platform.platform
    }
  });
}
