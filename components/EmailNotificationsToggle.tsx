"use client";

import { useState } from "react";

export default function EmailNotificationsToggle({
  initial,
  email,
}: {
  initial: boolean;
  email: string;
}) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setSaving(true);
    setErr(null);
    // Optimistic
    setOn(next);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || "No se pudo guardar");
        setOn(!next); // revert
      }
    } catch (e: any) {
      setErr(e.message);
      setOn(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-white">📧 Notificaciones por email</div>
          <div className="text-xs text-white/50">
            Recibir un correo en <code className="text-white/70">{email}</code> cada vez que un Reel esté listo.
          </div>
          {err && <div className="mt-1 text-xs text-red-300">{err}</div>}
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={on}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            on ? "bg-fuchsia-500" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
