import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import youtubedl from "youtube-dl-exec";
import { detectPlatform, isSupportedUrl } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YT_DLP_BIN: string =
  (youtubedl as any).binaryPath ||
  process.env.YT_DLP_PATH ||
  "yt-dlp";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const IG_COOKIES_PATH = process.env.IG_COOKIES_PATH || "";
const IG_COOKIES_OK = !!IG_COOKIES_PATH && existsSync(IG_COOKIES_PATH);

function dumpJson(
  url: string,
  useCustomUA: boolean,
  cookiesPath?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const args = [
    url,
    "--dump-single-json",
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificates"
  ];
  if (useCustomUA) {
    args.push(
      "--user-agent", USER_AGENT,
      "--add-header", "Accept-Language:en-US,en;q=0.9"
    );
  }
  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }
  return new Promise((resolve) => {
    const child = spawn(YT_DLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", () => resolve({ code: 1, stdout, stderr }));
  });
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string" || !isSupportedUrl(url)) {
      return NextResponse.json({ error: "URL no soportada" }, { status: 400 });
    }

    const platform = detectPlatform(url);

    if (platform.platform === "instagram" && !IG_COOKIES_OK) {
      return NextResponse.json(
        {
          error: "Instagram no disponible",
          detail:
            "Instagram cambio sus restricciones y ya no permite descargas sin sesion iniciada. Esta plataforma esta temporalmente deshabilitada. Probe con YouTube, TikTok, Facebook o X."
        },
        { status: 503 }
      );
    }

    const cookiesPath = platform.platform === "instagram" ? IG_COOKIES_PATH : undefined;
    const result = await dumpJson(url, platform.platform !== "facebook", cookiesPath);

    if (result.code !== 0 || !result.stdout.trim()) {
      return NextResponse.json(
        {
          error: "No se pudo obtener informacion del video",
          detail: result.stderr.slice(-1500).trim()
        },
        { status: 502 }
      );
    }

    let info: any;
    try {
      info = JSON.parse(result.stdout);
    } catch (e: any) {
      return NextResponse.json(
        { error: "No se pudo obtener informacion del video", detail: String(e?.message || e) },
        { status: 502 }
      );
    }

    const formats = Array.isArray(info.formats)
      ? info.formats
          .filter((f: any) => f.vcodec && f.vcodec !== "none")
          .map((f: any) => ({
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.resolution || (f.height ? `${f.height}p` : null),
            height: f.height ?? null,
            fps: f.fps ?? null,
            filesize: f.filesize ?? f.filesize_approx ?? null,
            tbr: f.tbr ?? null,
            note: f.format_note ?? null
          }))
      : [];

    return NextResponse.json({
      platform: platform.platform,
      platformLabel: platform.label,
      title: info.title ?? "video",
      thumbnail: info.thumbnail ?? null,
      duration: info.duration ?? null,
      uploader: info.uploader ?? info.channel ?? null,
      formats
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudo obtener informacion del video", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
