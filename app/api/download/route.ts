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
    "--no-call-home",
    "--no-check-certificates"
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

  const stream = new ReadableStream({
    start(controller) {
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
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
      "X-Platform": platform.platform
    }
  });
}
