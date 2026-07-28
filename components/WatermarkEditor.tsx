"use client";

import { useState } from "react";

type Props = {
  initialText: string;
  initialAnim: boolean;
};

export default function WatermarkEditor({ initialText, initialAnim }: Props) {
  const [text, setText] = useState(initialText || "");
  const [anim, setAnim] = useState(initialAnim);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermarkText: text, watermarkAnim: anim }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "No se pudo guardar" });
        return;
      }
      setMsg({ kind: "ok", text: text ? "Watermark guardado" : "Watermark quitado" });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/5 to-violet-500/5 p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💎</span>
          <div className="font-medium text-white">Watermark personalizado</div>
          <span className="rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200">PREMIUM</span>
        </div>
        <div className="mt-1 text-xs text-white/50">
          Reemplaza el default de <code>tuvideodown.com</code> en tus Reels. Deja vacío para no llevar ninguno.
        </div>
      </div>

      <label className="block text-xs text-white/60 mb-1">Texto (máx. 40)</label>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="@tucanal, tu.marca, tuweb.com…"
        maxLength={40}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400 mb-3"
      />

      <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
        <span>
          <span className="block text-sm font-medium text-white">Watermark animado (anti-piratería)</span>
          <span className="block text-xs text-white/50">Se desplaza por el frame en vez de quedarse fijo en la esquina.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={anim}
          onClick={() => setAnim(!anim)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            anim ? "bg-fuchsia-500" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              anim ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "…" : "Guardar"}
        </button>
        {msg && (
          <div className={`text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
