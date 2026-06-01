import { NextRequest, NextResponse } from "next/server";
import youtubedl from "youtube-dl-exec";
import { detectPlatform, isSupportedUrl } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string" || !isSupportedUrl(url)) {
      return NextResponse.json({ error: "URL no soportada" }, { status: 400 });
    }

    const platform = detectPlatform(url);

    const info: any = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      addHeader: ["referer:youtube.com", "user-agent:googlebot"]
    });

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
