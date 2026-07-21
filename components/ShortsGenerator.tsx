"use client";

import { useEffect, useRef, useState } from "react";

type Highlight = { start: number; end: number; hook: string; reason: string };
type AnalyzeJob = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  stage?: string;
  progress?: number;
  error?: string;
  result?: {
    duration: number;
    language: string;
    highlights: Highlight[];
  };
};
type GenerateJob = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  stage?: string;
  progress?: number;
  error?: string;
  result?: {
    shorts: { index: number; file: string; duration: number; hook: string; script: string }[];
    style: string;
    voice: string;
  };
};

type Step = "idle" | "analyzing" | "picking" | "generating" | "done" | "error";

const STYLES = [
  {
    id: "original",
    label: "Recorte del original",
    desc: "Trozo del vídeo original recentrado a 9:16",
  },
  {
    id: "blur",
    label: "Blur + vídeo centrado",
    desc: "Fondo blureado del propio vídeo con el vídeo nítido encima",
  },
  {
    id: "gradient",
    label: "Gradiente + captions grandes",
    desc: "Fondo minimalista, los captions son protagonistas",
  },
] as const;

const VOICES = [
  { id: "es-ES-AlvaroNeural", label: "Álvaro (España, energético)" },
  { id: "es-ES-ElviraNeural", label: "Elvira (España, cálida)" },
  { id: "es-MX-JorgeNeural", label: "Jorge (México, serio)" },
  { id: "es-MX-DaliaNeural", label: "Dalia (México, expresiva)" },
];

function fmtDuration(s: number): string {
  if (!s || !isFinite(s)) return "";
  const total = Math.round(s);
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function fmtStart(s: number): string {
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export default function ShortsGenerator() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [analyzeJob, setAnalyzeJob] = useState<AnalyzeJob | null>(null);
  const [generateJob, setGenerateJob] = useState<GenerateJob | null>(null);
  const [selectedHighlights, setSelectedHighlights] = useState<Set<number>>(new Set());
  const [style, setStyle] = useState<string>("blur");
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => clearPoll(), []);

  function clearPoll() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function submitAnalyze() {
    setError(null);
    if (!url.trim()) return;
    setStep("analyzing");
    setAnalyzeJob(null);
    setGenerateJob(null);
    setSelectedHighlights(new Set());

    try {
      const res = await fetch("/api/shorts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el análisis");
      pollJob("analyze", data.job_id);
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  async function submitGenerate() {
    if (!analyzeJob?.result || selectedHighlights.size === 0) return;
    setError(null);
    setStep("generating");
    try {
      const res = await fetch("/api/shorts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: analyzeJob.id,
          highlight_indices: [...selectedHighlights].sort((a, b) => a - b),
          style,
          voice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar la generación");
      pollJob("generate", data.job_id);
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  function pollJob(kind: "analyze" | "generate", jobId: string) {
    clearPoll();
    const tick = async () => {
      try {
        const res = await fetch(`/api/shorts/job/${jobId}`);
        const job = await res.json();
        if (!res.ok) throw new Error(job.error || "No se pudo consultar el estado");
        if (kind === "analyze") setAnalyzeJob({ ...job });
        else setGenerateJob({ ...job });

        if (job.status === "done") {
          clearPoll();
          if (kind === "analyze") setStep("picking");
          else setStep("done");
        } else if (job.status === "error") {
          clearPoll();
          setError(job.error || "Error desconocido");
          setStep("error");
        }
      } catch (e: any) {
        clearPoll();
        setError(e.message);
        setStep("error");
      }
    };
    tick();
    pollTimer.current = setInterval(tick, 2500);
  }

  function toggleHighlight(i: number) {
    setSelectedHighlights((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function reset() {
    clearPoll();
    setStep("idle");
    setAnalyzeJob(null);
    setGenerateJob(null);
    setSelectedHighlights(new Set());
    setError(null);
  }

  const stageLabel: Record<string, string> = {
    download: "Descargando vídeo…",
    extract_audio: "Extrayendo audio…",
    transcribe: "Transcribiendo con Whisper (esto tarda)…",
    highlights: "Detectando momentos virales con IA…",
    starting: "Preparando render…",
    ready: "Highlights listos",
    done: "Terminado",
  };
  const currentStage = (analyzeJob?.stage || generateJob?.stage || "").split("/")[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {/* Paso 1: URL input */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={step !== "idle" && step !== "error"}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-violet-400"
        />
        <button
          onClick={submitAnalyze}
          disabled={!url.trim() || (step !== "idle" && step !== "error")}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
        >
          Analizar vídeo
        </button>
      </div>

      {step === "error" && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <div className="font-medium">Algo falló</div>
          <div className="opacity-80">{error}</div>
          <button
            onClick={reset}
            className="mt-2 text-xs underline underline-offset-2 hover:text-white"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {(step === "analyzing" || step === "generating") && (
        <ProgressBar
          progress={(step === "analyzing" ? analyzeJob?.progress : generateJob?.progress) || 0}
          label={stageLabel[currentStage] || (step === "analyzing" ? "Procesando…" : "Renderizando Shorts…")}
          subLabel={step === "generating" ? generateJob?.stage || "" : undefined}
        />
      )}

      {step === "picking" && analyzeJob?.result && (
        <div className="mt-6 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Momentos con potencial viral ({analyzeJob.result.highlights.length})
            </h3>
            <p className="text-sm text-white/60">
              Duración del vídeo: {fmtDuration(analyzeJob.result.duration)} · idioma detectado:{" "}
              {analyzeJob.result.language.toUpperCase()}
            </p>
          </div>
          <ul className="space-y-2">
            {analyzeJob.result.highlights.map((h, i) => {
              const active = selectedHighlights.has(i);
              return (
                <li
                  key={i}
                  onClick={() => toggleHighlight(i)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                    active
                      ? "border-violet-400 bg-violet-500/15"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${
                        active ? "border-violet-300 bg-violet-500" : "border-white/30"
                      }`}
                    >
                      {active && <span className="text-xs text-white">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{fmtStart(h.start)} → {fmtStart(h.end)}</span>
                        <span>·</span>
                        <span>{Math.round(h.end - h.start)}s</span>
                      </div>
                      <div className="mt-1 font-medium text-white">"{h.hook}"</div>
                      <div className="mt-1 text-sm text-white/60">{h.reason}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <StyleAndVoicePicker
            style={style}
            setStyle={setStyle}
            voice={voice}
            setVoice={setVoice}
          />

          <button
            onClick={submitGenerate}
            disabled={selectedHighlights.size === 0}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-40"
          >
            Generar {selectedHighlights.size || ""} Short{selectedHighlights.size === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {step === "done" && generateJob?.result && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Listos: {generateJob.result.shorts.length} Short{generateJob.result.shorts.length === 1 ? "" : "s"}
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {generateJob.result.shorts.map((s) => (
              <li key={s.index} className="rounded-xl border border-white/10 bg-black/40 p-3">
                <video
                  src={`/api/shorts/download/${generateJob.id}/${s.index}`}
                  controls
                  playsInline
                  className="w-full aspect-[9/16] rounded-lg bg-black"
                />
                <div className="mt-2 text-sm text-white/80 line-clamp-2">"{s.hook}"</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/50">
                  <span>{fmtDuration(s.duration)}</span>
                  <a
                    href={`/api/shorts/download/${generateJob.id}/${s.index}`}
                    download={`short-${s.index + 1}.mp4`}
                    className="rounded bg-violet-500/20 px-2 py-1 text-violet-200 hover:bg-violet-500/30"
                  >
                    Descargar
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={reset}
            className="text-sm text-white/60 underline underline-offset-2 hover:text-white"
          >
            Hacer otro vídeo
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  progress,
  label,
  subLabel,
}: {
  progress: number;
  label: string;
  subLabel?: string;
}) {
  const pct = Math.max(2, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {subLabel && (
        <div className="mt-1 text-xs text-white/40">{subLabel}</div>
      )}
      <div className="mt-3 text-xs text-white/40">
        Puede tardar entre 30 s y 3 min según la duración del vídeo. No cierres esta pestaña.
      </div>
    </div>
  );
}

function StyleAndVoicePicker({
  style,
  setStyle,
  voice,
  setVoice,
}: {
  style: string;
  setStyle: (s: string) => void;
  voice: string;
  setVoice: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <div className="mb-2 text-sm font-medium text-white/80">Estilo visual</div>
        <div className="space-y-2">
          {STYLES.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                style === s.id
                  ? "border-violet-400 bg-violet-500/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <input
                type="radio"
                name="style"
                value={s.id}
                checked={style === s.id}
                onChange={() => setStyle(s.id)}
                className="mt-1 accent-violet-500"
              />
              <span>
                <span className="block font-medium text-white">{s.label}</span>
                <span className="block text-xs text-white/50">{s.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-white/80">Voz</div>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-violet-400"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id} className="bg-neutral-900">
              {v.label}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-white/40">
          Voz IA neural gratis (Microsoft Edge). Idioma detectado automáticamente.
        </div>
      </div>
    </div>
  );
}
