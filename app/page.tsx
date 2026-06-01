"use client";

import { useMemo, useState } from "react";
import { detectPlatform } from "@/lib/platforms";

type VideoFormat = {
  format_id: string;
  ext: string;
  resolution: string | null;
  height: number | null;
  fps: number | null;
  filesize: number | null;
  tbr: number | null;
  note: string | null;
};

type VideoInfo = {
  platform: string;
  platformLabel: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  formats: VideoFormat[];
};

const QUALITIES: { value: string; label: string }[] = [
  { value: "best",  label: "Mejor calidad" },
  { value: "1080",  label: "1080p" },
  { value: "720",   label: "720p" },
  { value: "480",   label: "480p" },
  { value: "360",   label: "360p" },
  { value: "audio", label: "Solo audio (m4a)" }
];

function formatDuration(s: number | null): string {
  if (!s || !isFinite(s)) return "";
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
  const hr  = Math.floor(s / 3600);
  return hr > 0 ? `${hr}:${min}:${sec}` : `${min}:${sec}`;
}

export default function Page() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("best");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = useMemo(() => detectPlatform(url), [url]);
  const isValid = url.trim().length > 0 && platform.platform !== "unknown";

  async function fetchInfo() {
    setError(null);
    setInfo(null);
    if (!isValid) {
      setError("Pega un enlace de YouTube, TikTok, Instagram, X o Facebook.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error obteniendo info");
      setInfo(data);
    } catch (e: any) {
      setError(e?.message || "No se pudo procesar el enlace");
    } finally {
      setLoading(false);
    }
  }

  function startDownload() {
    if (!isValid) return;
    setDownloading(true);
    const params = new URLSearchParams({
      url,
      quality,
      title: info?.title || "video"
    });
    const href = `/api/download?${params.toString()}`;
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => setDownloading(false), 1500);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-4">
          <span className="size-2 rounded-full bg-green-400 animate-pulse" />
          Descarga directo al dispositivo
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Video Downloader
        </h1>
        <p className="mt-3 text-white/70 max-w-xl mx-auto">
          Pega el enlace de un video de YouTube, TikTok, Instagram, X o Facebook
          y descargalo al instante.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-5 sm:p-6 shadow-xl">
        <label className="text-sm text-white/70">Enlace del video</label>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 placeholder:text-white/40"
          />
          <button
            onClick={fetchInfo}
            disabled={loading || !isValid}
            className="rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition px-5 py-3 font-medium"
          >
            {loading ? "Analizando..." : "Analizar"}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-white/50">
            Plataforma detectada:{" "}
            <span className={platform.platform === "unknown" ? "text-red-300" : "text-emerald-300"}>
              {platform.label}
            </span>
          </span>
          <span className="text-white/40">
            {url.length > 0 ? `${url.length} caracteres` : ""}
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6">
          <label className="text-sm text-white/70">Calidad</label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  quality === q.value
                    ? "border-violet-400 bg-violet-500/20 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startDownload}
          disabled={!isValid || downloading}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition px-5 py-3 font-semibold"
        >
          {downloading ? "Preparando descarga..." : "Descargar al dispositivo"}
        </button>
      </section>

      {info && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 shadow-xl">
          <div className="flex gap-4">
            {info.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.thumbnail}
                alt={info.title}
                className="w-40 h-24 object-cover rounded-lg border border-white/10 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-white/50">
                {info.platformLabel}
              </div>
              <h2 className="text-lg font-semibold leading-snug line-clamp-2">
                {info.title}
              </h2>
              <div className="mt-1 text-sm text-white/60">
                {info.uploader ? `${info.uploader}` : ""}
                {info.duration ? ` - ${formatDuration(info.duration)}` : ""}
              </div>
            </div>
          </div>

          {info.formats.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-white/70 hover:text-white">
                Ver formatos disponibles ({info.formats.length})
              </summary>
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] text-white/60">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Ext</th>
                      <th className="text-left px-3 py-2">Resolucion</th>
                      <th className="text-left px-3 py-2">FPS</th>
                      <th className="text-left px-3 py-2">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/80">
                    {info.formats.map((f) => (
                      <tr key={f.format_id} className="border-t border-white/10">
                        <td className="px-3 py-1.5">{f.format_id}</td>
                        <td className="px-3 py-1.5">{f.ext}</td>
                        <td className="px-3 py-1.5">{f.resolution || "-"}</td>
                        <td className="px-3 py-1.5">{f.fps || "-"}</td>
                        <td className="px-3 py-1.5">{f.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-white/40">
        Solo para uso personal. Respeta los derechos de autor de cada plataforma.
      </footer>
    </main>
  );
}
