import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
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

  const id = randomBytes(8).toString("hex");
  const downloadPath = join(tmpdir(), `vd-${id}-dl.${ext}`);
  let faststartPath: string | null = null;

  const cleanup = async () => {
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
