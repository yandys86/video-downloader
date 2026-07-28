"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  connected: boolean;
  currentChatId?: string | null;
};

export default function TelegramConnect({ connected }: Props) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "code"; code: string; deepLink: string | null; expiresAt: string }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function generate() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", msg: data.error || "No se pudo generar código" });
        return;
      }
      setState({ kind: "code", code: data.code, deepLink: data.deepLink, expiresAt: data.expiresAt });
    } catch (e: any) {
      setState({ kind: "error", msg: e.message });
    }
  }

  async function unlink() {
    if (!confirm("¿Desvincular tu cuenta de Telegram? Dejarás de recibir Reels por ahí.")) return;
    await fetch("/api/telegram/unlink", { method: "POST" });
    router.refresh();
  }

  if (connected) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-emerald-100">📨 Telegram conectado</div>
            <div className="text-xs text-emerald-200/70">Recibirás cada Reel terminado en tu chat con el bot.</div>
          </div>
          <button
            onClick={unlink}
            className="rounded bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-red-500/20 hover:text-red-200"
          >
            Desvincular
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">📨 Recibir Reels por Telegram</div>
          <div className="text-xs text-white/50">
            Cuando termine cada Reel, te lo envía directo a tu Telegram (funciona con la pantalla bloqueada).
          </div>
        </div>
        {state.kind !== "code" && (
          <button
            onClick={generate}
            disabled={state.kind === "loading"}
            className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {state.kind === "loading" ? "Generando…" : "Conectar"}
          </button>
        )}
      </div>

      {state.kind === "code" && (
        <div className="mt-3 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
          <div className="text-xs text-fuchsia-100/80 mb-2">Pasos:</div>
          <ol className="ml-4 text-sm text-white/80 space-y-1 list-decimal">
            <li>
              Abre el bot:{" "}
              {state.deepLink ? (
                <a href={state.deepLink} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">
                  toca aquí
                </a>
              ) : (
                "busca @tuvideodown_bot en Telegram"
              )}
            </li>
            <li>Envía este comando al bot:</li>
          </ol>
          <div className="mt-2 rounded bg-black/40 px-3 py-2 font-mono text-lg text-fuchsia-200 tracking-widest text-center">
            /start {state.code}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-white/40">
              El código caduca en 15 min. Refresca esta página tras vincular.
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(`/start ${state.code}`)}
              className="text-xs text-white/60 hover:text-white underline"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.msg}
        </div>
      )}
    </div>
  );
}
