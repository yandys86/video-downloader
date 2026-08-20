import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import youtubedl from "youtube-dl-exec";
import { detectPlatform, isSupportedUrl, safeFilename } from "@/lib/platforms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Descargas son mucho más caras que /api/info: cada una arranca yt-dlp+ffmpeg.
// 10 por IP y hora es suficiente para uso legítimo, corta abusos.
const DOWNLOAD_RATE_LIMIT = 10;
const DOWNLOAD_RATE_WINDOW_MS = 60 * 60 * 1000;
// Semáforo global: no más de 4 descargas simultáneas en todo el server para
// no saturar CPU con múltiples ffmpeg concurrentes.
const MAX_CONCURRENT_DOWNLOADS = 4;
let inFlightDownloads = 0;

const YT_DLP_BIN: string =
  (youtubedl as any).binaryPath ||
  process.env.YT_DLP_PATH ||
  "yt-dlp";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const IG_COOKIES_PATH = process.env.IG_COOKIES_PATH || "";
const IG_COOKIES_OK = !!IG_COOKIES_PATH && existsSync(IG_COOKIES_PATH);

function buildFormatSelector(quality: string | null): string {
  const h = (max: string) =>
    `bestvideo[height<=${max}][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/` +
    `best[height<=${max}][ext=mp4][vcodec^=avc1]/` +
    `best[height<=${max}][ext=mp4][vcodec!^=av01][vcodec!^=vp]/` +
    `best[height<=${max}][ext=mp4]/best[height<=${max}]/` +
    `bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/` +
    `best[ext=mp4][vcodec^=avc1]/` +
    `best[ext=mp4][vcodec!^=av01][vcodec!^=vp]/` +
    `best[ext=mp4]/best`;
  switch (quality) {
    case "audio":
      return "bestaudio[ext=m4a]/bestaudio";
    case "360": return h("360");
    case "480": return h("480");
    case "720": return h("720");
    case "1080": return h("1080");
    case "best":
    default:
      return (
        "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/" +
        "best[ext=mp4][vcodec^=avc1]/" +
        "best[ext=mp4][vcodec!^=av01][vcodec!^=vp]/" +
        "best[ext=mp4]/best"
      );
  }
}

function buildContentDisposition(filename: string): string {
  const safe = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${safe}"`;
}

function runProcess(
  cmd: string,
  args: string[],
  captureStderr: boolean
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "ignore", captureStderr ? "pipe" : "ignore"]
    });
    let stderrBuf = "";
    if (captureStderr && child.stderr) {
      child.stderr.on("data", (d) => {
        stderrBuf += d.toString();
        if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-4000);
      });
    }
    child.on("close", (code) => resolve({ code: code ?? 1, stderr: stderrBuf }));
    child.on("error", () => resolve({ code: 1, stderr: stderrBuf }));
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Rate limit por IP.
  const ip = getClientIp(req);
  const rl = checkRateLimit(`dl:${ip}`, DOWNLOAD_RATE_LIMIT, DOWNLOAD_RATE_WINDOW_MS);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `Demasiadas descargas. Reintenta en ${Math.ceil(rl.retryAfter / 60)} min.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // Semáforo global de concurrencia: si hay ya 4 descargas activas rechaza
  // rápido en lugar de encolar (evita colgar al usuario y saturar CPU).
  if (inFlightDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    return new Response(
      JSON.stringify({
        error: "Servidor ocupado, prueba en unos segundos.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "10",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const quality = searchParams.get("quality");

  if (!url || !isSupportedUrl(url)) {
    return new Response(JSON.stringify({ error: "URL no soportada" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const isAudio = quality === "audio";
  const ext = isAudio ? "m4a" : "mp4";
  const rawFromPath = decodeURIComponent(params.filename || "");
  const baseName = rawFromPath.replace(/\.(mp4|m4a|mkv|webm)$/i, "");
  const filename = safeFilename(baseName || "video", ext);
  const platform = detectPlatform(url);

  if (platform.platform === "instagram" && !IG_COOKIES_OK) {
    return new Response(
      JSON.stringify({
        error: "Instagram no disponible",
        hint: "Instagram cambio sus restricciones y ya no permite descargas sin sesion iniciada. Probe con YouTube, TikTok, Facebook o X."
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      }
    );
  }

  const id = randomBytes(8).toString("hex");
  const downloadPath = join(tmpdir(), `vd-${id}-dl.${ext}`);
  let faststartPath: string | null = null;

  // Reserva slot en el semáforo. Se libera en cleanup() suceda lo que suceda.
  inFlightDownloads++;
  let released = false;
  const releaseSlot = () => {
    if (released) return;
    released = true;
    inFlightDownloads = Math.max(0, inFlightDownloads - 1);
  };

  const cleanup = async () => {
    releaseSlot();
    await unlink(downloadPath).catch(() => {});
    if (faststartPath) await unlink(faststartPath).catch(() => {});
  };

  const args = [
    url,
    "-f", buildFormatSelector(quality),
    "-o", downloadPath,
    "--no-warnings",
    "--no-playlist",
    "--no-progress",
    "--no-check-certificates"
  ];
  if (platform.platform !== "facebook") {
    args.push(
      "--user-agent", USER_AGENT,
      "--add-header", "Accept-Language:en-US,en;q=0.9"
    );
  }
  if (platform.platform === "youtube") {
    // El player_client por defecto (visionos) devuelve 403 en googlevideo.com
    // desde IPs de servidor. web+android da URLs firmadas que sí bajan.
    args.push("--extractor-args", "youtube:player_client=web,android");
  }
  if (platform.platform === "instagram") {
    args.push("--cookies", IG_COOKIES_PATH);
  }

  if (!isAudio) {
    args.push("--merge-output-format", "mp4");
  } else {
    args.push("-x", "--audio-format", "m4a");
  }

  const ytdlp = await runProcess(YT_DLP_BIN, args, true);

  if (ytdlp.code !== 0) {
    await cleanup();
    return new Response(
      JSON.stringify({
        error: "yt-dlp no pudo descargar este video",
        hint: "La plataforma puede requerir autenticacion, el video puede estar privado/geo-bloqueado, o el formato pedido no esta disponible.",
        detail: ytdlp.stderr.slice(-1500).trim()
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      }
    );
  }

  let servePath = downloadPath;
  if (!isAudio) {
    faststartPath = join(tmpdir(), `vd-${id}-fs.mp4`);
    const remux = await runProcess("ffmpeg", [
      "-y", "-i", downloadPath,
      "-c", "copy",
      "-movflags", "+faststart",
      faststartPath
    ], false);
    if (remux.code === 0) {
      servePath = faststartPath;
    } else {
      await unlink(faststartPath).catch(() => {});
      faststartPath = null;
    }
  }

  let fileSize: number;
  try {
    fileSize = (await stat(servePath)).size;
  } catch {
    await cleanup();
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }

  const readStream = createReadStream(servePath);
  const stream = new ReadableStream({
    start(controller) {
      readStream.on("data", (chunk) => controller.enqueue(chunk));
      readStream.on("end", () => {
        controller.close();
        cleanup();
      });
      readStream.on("error", (err) => {
        controller.error(err);
        cleanup();
      });
    },
    cancel() {
      readStream.destroy();
      cleanup();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": isAudio ? "audio/mp4" : "video/mp4",
      "Content-Length": String(fileSize),
      "Content-Disposition": buildContentDisposition(filename),
      "Cache-Control": "no-store",
      "X-Platform": platform.platform
    }
  });
}
