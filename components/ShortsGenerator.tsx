"use client";

import { useEffect, useRef, useState } from "react";
import { isPushSupported, needsPWAInstallOnIOS, subscribeToPushForJob } from "@/lib/push";

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
type Mode = "ai" | "manual";

const STYLES = [
  { id: "original", label: "Original", desc: "Recorte 9:16 del vídeo" },
  { id: "blur", label: "Blur", desc: "Fondo blureado + vídeo centrado" },
  { id: "gradient", label: "Gradiente", desc: "Fondo minimalista con captions grandes" },
] as const;

// Duraciones profesionales estilo Instagram/TikTok. null = usar el rango del highlight tal cual.
const DURATIONS: Array<{ value: number | null; label: string }> = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
  { value: null, label: "Auto" },
];

const VOICES = [
  { id: "es-ES-AlvaroNeural", label: "Álvaro (España, energético)" },
  { id: "es-ES-ElviraNeural", label: "Elvira (España, cálida)" },
  { id: "es-MX-JorgeNeural", label: "Jorge (México, serio)" },
  { id: "es-MX-DaliaNeural", label: "Dalia (México, expresiva)" },
];

const VOICE_MODES = [
  {
    id: "original",
    label: "Audio original del vídeo",
    desc: "Usa el audio y voz del vídeo original (más rápido, ideal para clips virales tal cual).",
  },
  {
    id: "ai",
    label: "Voz IA (reescrito por Claude)",
    desc: "Claude reescribe el guion y una voz sintética lo narra. Tarda más pero suena limpio.",
  },
] as const;

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

// Acepta "mm:ss", "hh:mm:ss", o "123" (segundos crudos). Devuelve null si inválido.
function parseTime(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length === 1) {
    const n = parseFloat(parts[0]);
    return isFinite(n) && n >= 0 ? n : null;
  }
  if (parts.length === 2) {
    const [m, sec] = parts.map(Number);
    return isFinite(m) && isFinite(sec) ? m * 60 + sec : null;
  }
  if (parts.length === 3) {
    const [h, m, sec] = parts.map(Number);
    return isFinite(h) && isFinite(m) && isFinite(sec) ? h * 3600 + m * 60 + sec : null;
  }
  return null;
}

// Notificación de escritorio/móvil cuando el usuario NO está mirando la pestaña.
function notifyIfBackground(title: string, body: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, icon: "/icon.svg" });
  } catch {}
}

// LocalStorage: guardar los últimos jobs para poder reanudar tras cerrar la pestaña.
type StoredJob = {
  id: string;
  kind: "analyze" | "generate";
  url?: string;
  parent_id?: string;
  ts: number;
  status?: string;
};

function loadHistory(): StoredJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("shorts:history");
    if (!raw) return [];
    const arr = JSON.parse(raw) as StoredJob[];
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return arr.filter((j) => j && j.ts >= cutoff);
  } catch {
    return [];
  }
}

function saveJobToHistory(job: StoredJob) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter((j) => j.id !== job.id);
  list.unshift(job);
  try {
    localStorage.setItem("shorts:history", JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export default function ShortsGenerator() {
  const [mode, setMode] = useState<Mode>("ai");
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [analyzeJob, setAnalyzeJob] = useState<AnalyzeJob | null>(null);
  const [generateJob, setGenerateJob] = useState<GenerateJob | null>(null);
  const [selectedHighlights, setSelectedHighlights] = useState<Set<number>>(new Set());
  const [customRanges, setCustomRanges] = useState<Array<{ start: string; hook: string }>>([]);
  const [clipDuration, setClipDuration] = useState<number | null>(30); // por defecto 30s
  const [style, setStyle] = useState<string>("blur");
  const [voiceMode, setVoiceMode] = useState<string>("original");
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredJob[]>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => clearPoll(), []);
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Pedir permiso de notificación en cuanto haya un job en marcha
  // (algunos navegadores requieren gesture — el click en Analizar ya lo es).
  function ensureNotificationPermission() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function clearPoll() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function submitQuickClip() {
    setError(null);
    const startSec = parseTime(manualStart);
    const endSec = manualEnd.trim() ? parseTime(manualEnd) : null;
    if (!url.trim() || startSec === null) {
      setError("Rellena URL e inicio (mm:ss).");
      return;
    }
    if (manualEnd.trim() && endSec === null) {
      setError("Formato de 'fin' inválido. Usa mm:ss (ej. 47:30) o segundos.");
      return;
    }
    if (endSec !== null && endSec <= startSec) {
      setError("El 'fin' debe ser posterior al 'inicio'.");
      return;
    }
    if (endSec === null && !clipDuration) {
      setError("Elige una duración o especifica 'fin'.");
      return;
    }

    ensureNotificationPermission();
    setStep("generating");
    setGenerateJob(null);
    try {
      const payload: Record<string, unknown> = {
        url: url.trim(),
        start: startSec,
        style,
        voice_mode: voiceMode,
        voice,
      };
      if (endSec !== null) {
        payload.end = endSec;  // el backend calculará la duración
      } else {
        payload.duration = clipDuration;
      }
      const res = await fetch("/api/shorts/quick_clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el recorte");
      saveJobToHistory({ id: data.job_id, kind: "generate", url: url.trim(), ts: Date.now() });
      subscribeToPushForJob(data.job_id).catch(() => {});
      pollJob("generate", data.job_id);
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  async function submitAnalyze() {
    setError(null);
    if (!url.trim()) return;
    ensureNotificationPermission();
    setStep("analyzing");
    setAnalyzeJob(null);
    setGenerateJob(null);
    setSelectedHighlights(new Set());
    setCustomRanges([]);

    try {
      const res = await fetch("/api/shorts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el análisis");
      saveJobToHistory({ id: data.job_id, kind: "analyze", url: url.trim(), ts: Date.now() });
      // Suscribir a Web Push para este job (background notification)
      subscribeToPushForJob(data.job_id).catch(() => {});
      pollJob("analyze", data.job_id);
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  async function submitGenerate() {
    if (!analyzeJob?.result) return;
    // Parsea rangos custom: solo necesita start (la duración la marca clipDuration global).
    const validCustom = customRanges
      .map((r) => ({ start: parseTime(r.start), hook: r.hook || "" }))
      .filter((r): r is { start: number; hook: string } => r.start !== null);
    if (selectedHighlights.size === 0 && validCustom.length === 0) return;
    if (customRanges.length > validCustom.length) {
      setError("Formato de tiempo inválido en algún rango. Usa mm:ss (ej. 1:30).");
      return;
    }

    ensureNotificationPermission();
    setError(null);
    setStep("generating");
    try {
      const res = await fetch("/api/shorts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: analyzeJob.id,
          highlight_indices: [...selectedHighlights].sort((a, b) => a - b),
          custom_ranges: validCustom,   // solo start; end lo pone el backend con clip_duration
          clip_duration: clipDuration,   // null = usar rango completo del highlight
          style,
          voice_mode: voiceMode,
          voice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar la generación");
      saveJobToHistory({
        id: data.job_id, kind: "generate", parent_id: analyzeJob.id, ts: Date.now(),
      });
      subscribeToPushForJob(data.job_id).catch(() => {});
      pollJob("generate", data.job_id);
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  function pollJob(kind: "analyze" | "generate", jobId: string) {
    clearPoll();
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5; // ~12s de errores transitorios antes de rendirse
    const tick = async () => {
      try {
        const res = await fetch(`/api/shorts/job/${jobId}`);
        // 5xx transitorios: no reventar la UI, deja que el siguiente tick lo intente
        if (res.status >= 500 && res.status < 600) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            clearPoll();
            setError("El servidor está tardando en responder. Reintenta en unos segundos.");
            setStep("error");
          }
          return;
        }
        const job = await res.json();
        if (!res.ok) throw new Error(job.error || "No se pudo consultar el estado");
        consecutiveFailures = 0; // reset al primer éxito
        if (kind === "analyze") setAnalyzeJob({ ...job });
        else setGenerateJob({ ...job });

        if (job.status === "done") {
          clearPoll();
          if (kind === "analyze") {
            setStep("picking");
            notifyIfBackground(
              "Análisis listo",
              `Se detectaron ${job.result?.highlights?.length || 0} momentos virales. Vuelve a la pestaña para elegir.`,
            );
          } else {
            setStep("done");
            notifyIfBackground(
              "Shorts listos",
              `${job.result?.shorts?.length || 0} Short(s) generados y listos para descargar.`,
            );
          }
        } else if (job.status === "error") {
          clearPoll();
          setError(job.error || "Error desconocido");
          setStep("error");
        }
      } catch (e: any) {
        // Fallos de red o parse: se cuentan igual que 5xx
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          clearPoll();
          setError(e.message || "Error de red persistente");
          setStep("error");
        }
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
    setCustomRanges([]);
    setManualStart("");
    setManualEnd("");
    setError(null);
    setHistory(loadHistory());
  }

  // Reanudar un job de un intento anterior (viene del historial en localStorage).
  function resumeJob(jobId: string, kind: "analyze" | "generate") {
    setError(null);
    if (kind === "analyze") {
      setStep("analyzing");
      setAnalyzeJob({ id: jobId, status: "running" });
    } else {
      setStep("generating");
      setGenerateJob({ id: jobId, status: "running" });
    }
    pollJob(kind, jobId);
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

  const idleOrError = step === "idle" || step === "error";
  const [showIOSHint, setShowIOSHint] = useState(false);
  useEffect(() => {
    // Detectar tras montar (needsPWAInstallOnIOS accede a window)
    setShowIOSHint(isPushSupported() === false && needsPWAInstallOnIOS());
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {showIOSHint && (
        <div className="mb-4 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
          <div className="font-medium">📲 Para recibir notificaciones en iPhone</div>
          <div className="mt-1 text-xs text-fuchsia-200/80">
            Toca <strong>Compartir</strong> abajo (⎋) → <strong>Añadir a pantalla de inicio</strong>.
            Después abre la app desde el ícono y te avisará cuando el Reel esté listo aunque cierres la pantalla.
          </div>
        </div>
      )}

      {/* Mode toggle */}
      {idleOrError && (
        <div className="mb-4 flex gap-1.5 rounded-lg bg-white/[0.03] p-1">
          <button
            onClick={() => setMode("ai")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "ai"
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow"
                : "text-white/60 hover:text-white"
            }`}
          >
            🤖 Análisis IA
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "manual"
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow"
                : "text-white/60 hover:text-white"
            }`}
          >
            ✂️ Recorte manual
          </button>
        </div>
      )}
      {idleOrError && (
        <p className="mb-3 text-xs text-white/50">
          {mode === "ai"
            ? "Claude detecta los mejores momentos del vídeo (para podcasts, entrevistas, tutoriales)."
            : "Elige tú el minuto exacto — perfecto para películas y series de 2h+. No descarga el vídeo entero, solo el trozo que quieres."}
        </p>
      )}

      {/* Paso 1: URL input */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!idleOrError}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-violet-400"
        />
        {mode === "ai" && (
          <button
            onClick={submitAnalyze}
            disabled={!url.trim() || !idleOrError}
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            Analizar vídeo
          </button>
        )}
      </div>

      {/* Panel de recorte manual: inputs + controles */}
      {mode === "manual" && idleOrError && (
        <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-white">
                ⏱️ Inicio
              </label>
              <input
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                placeholder="mm:ss  ·  45:30"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/30 outline-none focus:border-fuchsia-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white">
                🏁 Fin <span className="text-xs font-normal text-white/40">(opcional)</span>
              </label>
              <input
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                placeholder="mm:ss  ·  46:30"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/30 outline-none focus:border-fuchsia-400"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-white/40">
            Si pones <em>Fin</em>, se usa ese rango exacto. Si lo dejas vacío, se usa la duración de abajo.
          </p>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium text-white">
                Duración del Reel
                {manualEnd.trim() && <span className="ml-2 text-xs text-white/40">(ignorada — usarás Inicio → Fin)</span>}
              </span>
              <span className="text-xs text-white/40">
                {clipDuration ? `${clipDuration}s` : "elige"}
              </span>
            </div>
            <div className={manualEnd.trim() ? "opacity-40 pointer-events-none" : ""}>
              <PillGroup
                options={DURATIONS.filter((d) => d.value !== null).map((d) => ({ id: String(d.value), label: d.label }))}
                value={String(clipDuration ?? 30)}
                onChange={(v) => setClipDuration(Number(v))}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-white">🎬 Estilo</div>
            <PillGroup
              options={STYLES.map((s) => ({ id: s.id, label: s.label }))}
              value={style}
              onChange={setStyle}
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-white">🎙️ Voz</div>
            <PillGroup
              options={[
                { id: "original", label: "Original del vídeo" },
                { id: "ai", label: "Voz IA" },
              ]}
              value={voiceMode}
              onChange={setVoiceMode}
            />
          </div>

          <button
            onClick={submitQuickClip}
            disabled={!url.trim() || !manualStart.trim() || !idleOrError}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
          >
            Cortar y generar Reel
          </button>
        </div>
      )}

      {/* Historial: si hay jobs recientes en localStorage, ofrecer reanudar */}
      {step === "idle" && history.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-xs font-medium text-white/70 mb-2">Trabajos recientes</div>
          <ul className="space-y-1.5">
            {history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-white/60">
                  <span className="text-white/80">{h.kind === "analyze" ? "Análisis" : "Generación"}</span>
                  {" · "}
                  {h.url ? new URL(h.url).hostname : "job"}{" "}
                  <span className="text-white/40">
                    {new Date(h.ts).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <button
                  onClick={() => resumeJob(h.id, h.kind)}
                  className="ml-2 shrink-0 rounded bg-violet-500/20 px-2 py-0.5 text-violet-200 hover:bg-violet-500/30"
                >
                  Reanudar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <p className="text-xs text-fuchsia-300/80 mt-1">
              ✓ Puedes marcar <strong>varios a la vez</strong> — se generarán todos.
            </p>
          </div>
          <ul className="space-y-2">
            {analyzeJob.result.highlights.map((h, i) => {
              const active = selectedHighlights.has(i);
              return (
                <li
                  key={i}
                  className={`rounded-xl border px-4 py-3 transition ${
                    active
                      ? "border-violet-400 bg-violet-500/15"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => toggleHighlight(i)}
                      className={`mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded border ${
                        active ? "border-violet-300 bg-violet-500" : "border-white/30"
                      }`}
                    >
                      {active && <span className="text-xs text-white">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleHighlight(i)}>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{fmtStart(h.start)} → {fmtStart(h.end)}</span>
                        <span>·</span>
                        <span>{Math.round(h.end - h.start)}s</span>
                      </div>
                      <div className="mt-1 font-medium text-white">"{h.hook}"</div>
                      <div className="mt-1 text-sm text-white/60">{h.reason}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Convertir este auto highlight en un rango editable
                        // (solo start — la duración la controla el pill de arriba)
                        setCustomRanges((prev) => [
                          ...prev,
                          {
                            start: fmtStart(h.start),
                            hook: h.hook || "",
                          },
                        ]);
                        setSelectedHighlights((prev) => {
                          const next = new Set(prev);
                          next.delete(i);
                          return next;
                        });
                      }}
                      className="shrink-0 rounded bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      title="Convertir en momento editable con inicio personalizado"
                    >
                      ✏️
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Rangos personalizados — versión compacta: solo start (la duración la marca el pill global) */}
          {customRanges.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/70">Momentos personalizados</div>
              {customRanges.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={r.start}
                    onChange={(e) => setCustomRanges((p) => p.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                    placeholder="mm:ss"
                    className="w-24 rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400"
                  />
                  <input
                    value={r.hook}
                    onChange={(e) => setCustomRanges((p) => p.map((x, j) => j === i ? { ...x, hook: e.target.value } : x))}
                    placeholder="Título (opcional)"
                    className="flex-1 rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400"
                  />
                  <button
                    onClick={() => setCustomRanges((p) => p.filter((_, j) => j !== i))}
                    className="shrink-0 rounded bg-white/5 px-2 py-1.5 text-xs text-white/60 hover:bg-red-500/20 hover:text-red-200"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setCustomRanges((p) => [...p, { start: "", hook: "" }])}
            className="w-full rounded-lg border border-dashed border-white/15 py-2 text-xs text-white/50 hover:border-fuchsia-400/50 hover:text-fuchsia-200"
          >
            + Añadir momento personalizado
          </button>

          {/* Panel de controles: duración + estilo + voz — pills profesionales */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            {/* Duración */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-white">⏱️ Duración del Reel</span>
                <span className="text-xs text-white/40">
                  {clipDuration === null ? "usa el tramo detectado" : `cada clip será de ${clipDuration}s`}
                </span>
              </div>
              <PillGroup
                options={DURATIONS.map((d) => ({ id: String(d.value), label: d.label }))}
                value={String(clipDuration)}
                onChange={(v) => setClipDuration(v === "null" ? null : Number(v))}
              />
            </div>

            {/* Estilo */}
            <div>
              <div className="mb-2 text-sm font-medium text-white">🎬 Estilo</div>
              <PillGroup
                options={STYLES.map((s) => ({ id: s.id, label: s.label }))}
                value={style}
                onChange={setStyle}
              />
              <div className="mt-1 text-xs text-white/40">
                {STYLES.find((s) => s.id === style)?.desc}
              </div>
            </div>

            {/* Voz */}
            <div>
              <div className="mb-2 text-sm font-medium text-white">🎙️ Voz</div>
              <PillGroup
                options={[
                  { id: "original", label: "Original del vídeo" },
                  { id: "ai", label: "Voz IA" },
                ]}
                value={voiceMode}
                onChange={setVoiceMode}
              />
              {voiceMode === "ai" && (
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-neutral-900">
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {(() => {
            const validCustomCount = customRanges.filter((r) => parseTime(r.start) !== null).length;
            const totalCount = selectedHighlights.size + validCustomCount;
            return (
              <button
                onClick={submitGenerate}
                disabled={totalCount === 0}
                className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-40"
              >
                {totalCount === 0
                  ? "Selecciona al menos 1 momento"
                  : `Generar ${totalCount} Reel${totalCount === 1 ? "" : "s"}`}
              </button>
            );
          })()}
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

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-md shadow-violet-500/30"
                : "border border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StyleAndVoicePicker({
  style,
  setStyle,
  voiceMode,
  setVoiceMode,
  voice,
  setVoice,
}: {
  style: string;
  setStyle: (s: string) => void;
  voiceMode: string;
  setVoiceMode: (m: string) => void;
  voice: string;
  setVoice: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm font-medium text-white/80">Estilo visual</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOICE_MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                voiceMode === m.id
                  ? "border-fuchsia-400 bg-fuchsia-500/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <input
                type="radio"
                name="voice-mode"
                value={m.id}
                checked={voiceMode === m.id}
                onChange={() => setVoiceMode(m.id)}
                className="mt-1 accent-fuchsia-500"
              />
              <span>
                <span className="block font-medium text-white">{m.label}</span>
                <span className="block text-xs text-white/50">{m.desc}</span>
              </span>
            </label>
          ))}
        </div>
        {voiceMode === "ai" && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-white/60">Voz IA a usar:</div>
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
          </div>
        )}
      </div>
    </div>
  );
}
