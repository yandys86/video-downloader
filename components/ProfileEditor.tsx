"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Props = {
  initialName: string;
  email: string;
  hasPassword: boolean;
  loginProviders: string[]; // "google", "credentials"
};

export default function ProfileEditor({
  initialName,
  email,
  hasPassword,
  loginProviders,
}: Props) {
  const router = useRouter();
  const { update } = useSession();

  // ── Nombre
  const [name, setName] = useState(initialName || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveName() {
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameMsg({ kind: "err", text: data.error || "No se pudo guardar" });
        return;
      }
      setNameMsg({ kind: "ok", text: "Nombre actualizado" });
      await update();
      router.refresh();
    } catch (e: any) {
      setNameMsg({ kind: "err", text: e.message });
    } finally {
      setNameSaving(false);
    }
  }

  // ── Contraseña
  const [showPwForm, setShowPwForm] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function savePassword() {
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg({ kind: "err", text: "Mínimo 8 caracteres" });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ kind: "err", text: "Las contraseñas no coinciden" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: hasPassword ? current : undefined, next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ kind: "err", text: data.error || "No se pudo cambiar" });
        return;
      }
      setPwMsg({ kind: "ok", text: hasPassword ? "Contraseña actualizada" : "Contraseña establecida — ya puedes entrar con email/pw" });
      setCurrent("");
      setNext("");
      setConfirm("");
      setShowPwForm(false);
      router.refresh();
    } catch (e: any) {
      setPwMsg({ kind: "err", text: e.message });
    } finally {
      setPwSaving(false);
    }
  }

  const providerLabels = loginProviders
    .map((p) => (p === "google" ? "Google" : p === "credentials" ? "Email/contraseña" : p))
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* Datos básicos */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="font-medium text-white">👤 Perfil</div>
            <div className="text-xs text-white/50">Método de acceso: <span className="text-white/80">{providerLabels || "Email/contraseña"}</span></div>
          </div>
        </div>

        <label className="block text-xs text-white/60 mb-1">Email</label>
        <input
          value={email}
          disabled
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/50 mb-3"
        />

        <label className="block text-xs text-white/60 mb-1">Nombre a mostrar</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={60}
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
          />
          <button
            onClick={saveName}
            disabled={nameSaving || name === (initialName || "")}
            className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {nameSaving ? "…" : "Guardar"}
          </button>
        </div>
        {nameMsg && (
          <div className={`mt-2 text-xs ${nameMsg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {nameMsg.text}
          </div>
        )}
      </div>

      {/* Contraseña */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-white">🔒 Contraseña</div>
            <div className="text-xs text-white/50">
              {hasPassword
                ? "Cambiar tu contraseña de acceso."
                : "Tu cuenta se creó con Google. Puedes establecer una contraseña para entrar también con email/pw."}
            </div>
          </div>
          {!showPwForm && (
            <button
              onClick={() => setShowPwForm(true)}
              className="shrink-0 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              {hasPassword ? "Cambiar" : "Establecer"}
            </button>
          )}
        </div>

        {showPwForm && (
          <div className="mt-3 space-y-2">
            {hasPassword && (
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña actual"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
              />
            )}
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nueva contraseña (8+ caracteres)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={savePassword}
                disabled={pwSaving || !next || !confirm || (hasPassword && !current)}
                className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {pwSaving ? "…" : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setShowPwForm(false);
                  setCurrent("");
                  setNext("");
                  setConfirm("");
                  setPwMsg(null);
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {pwMsg && (
          <div className={`mt-2 text-xs ${pwMsg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {pwMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
