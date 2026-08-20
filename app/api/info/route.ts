import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import youtubedl from "youtube-dl-exec";
import { detectPlatform, isSupportedUrl } from "@/lib/platforms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { infoCache } from "@/lib/infoCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Límite: 30 llamadas a /api/info por IP y hora. Suficiente para navegación
// normal (pegar varias URLs), corta bots agresivos.
const INFO_RATE_LIMIT = 30;
const INFO_RATE_WINDOW_MS = 60 * 60 * 1000;

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
  cookiesPath?: string,
  platform?: string
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
  if (platform === "youtube") {
    args.push("--extractor-args", "youtube:player_client=web,android");
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
    // Rate limit por IP: 30/hora. Antes de hacer nada caro.
    const ip = getClientIp(req);
    const rl = checkRateLimit(`info:${ip}`, INFO_RATE_LIMIT, INFO_RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiadas consultas. Reintenta en ${rl.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string" || !isSupportedUrl(url)) {
      return NextResponse.json({ error: "URL no soportada" }, { status: 400 });
    }

    // Cache hit: devuelve la info sin invocar yt-dlp de nuevo.
    const cached = infoCache.get(url);
    if (cached) {
      return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
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
    const result = await dumpJson(url, platform.platform !== "facebook", cookiesPath, platform.platform);

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

    const responseData = {
      platform: platform.platform,
      platformLabel: platform.label,
      title: info.title ?? "video",
      thumbnail: info.thumbnail ?? null,
      duration: info.duration ?? null,
      uploader: info.uploader ?? info.channel ?? null,
      formats
    };
    infoCache.set(url, responseData);
    return NextResponse.json(responseData, { headers: { "X-Cache": "MISS" } });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudo obtener informacion del video", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
