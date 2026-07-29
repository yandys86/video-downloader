"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = {
  users: number;
  admins: number;
  premium: number;
  telegramLinked: number;
  signupsLast7d: number;
  revenueCents: number;
  revenueCentsLast7d: number;
  creditsSold: number;
  reelsLast24h: number;
  reelsLast7d: number;
  pendingPurchases: number;
};

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  credits: number;
  isPremium: boolean;
  emailNotifications: boolean;
  telegramNotifications: boolean;
  telegramChatId: string | null;
  createdAt: string;
  _count: { purchases: number };
};

function fmtEur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const limit = 50;

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    if (r.ok) setStats(await r.json());
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      setUsers(data.users);
      setTotal(data.total);
    }
    setLoading(false);
  }, [q, offset]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function patchUser(id: string, body: Record<string, unknown>, note: string) {
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      setFlash(`❌ ${data.error || "Error"}`);
      return;
    }
    setFlash(`✓ ${note}`);
    setTimeout(() => setFlash(null), 3000);
    await Promise.all([loadUsers(), loadStats()]);
  }

  async function adjustCredits(row: Row) {
    const input = prompt(`Ajustar créditos de ${row.email}. Escribe +N o -N (entero):`);
    if (!input) return;
    const delta = parseInt(input, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      setFlash("❌ valor inválido");
      return;
    }
    await patchUser(row.id, { creditsDelta: delta }, `créditos ${delta > 0 ? "+" : ""}${delta} → ${row.email}`);
  }

  return (
    <div className="space-y-8">
      {flash && (
        <div className="fixed top-16 right-3 z-40 rounded-lg bg-black/80 backdrop-blur border border-white/20 px-4 py-2 text-sm text-white shadow-xl">
          {flash}
        </div>
      )}

      {/* Stats */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Métricas</h2>
        {!stats ? (
          <div className="text-sm text-white/50">Cargando…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Usuarios" value={stats.users} sub={`+${stats.signupsLast7d} en 7 días`} />
            <StatCard label="Premium" value={stats.premium} sub={`${stats.admins} admins`} />
            <StatCard label="Ingresos totales" value={fmtEur(stats.revenueCents)} sub={`${fmtEur(stats.revenueCentsLast7d)} en 7 días`} accent />
            <StatCard label="Créditos vendidos" value={stats.creditsSold.toLocaleString("es-ES")} />
            <StatCard label="Reels 24h" value={stats.reelsLast24h} sub={`${stats.reelsLast7d} en 7 días`} />
            <StatCard label="Telegram vinculados" value={stats.telegramLinked} />
            <StatCard label="Compras pendientes" value={stats.pendingPurchases} sub={stats.pendingPurchases > 0 ? "Revisar" : undefined} />
          </div>
        )}
      </section>

      {/* Users */}
      <section>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Usuarios <span className="text-white/40 text-sm font-normal">({total})</span>
          </h2>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            placeholder="Buscar por email o nombre…"
            className="w-full sm:w-64 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
          />
        </div>

        {/* ── Vista MÓVIL: tarjetas ──────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {loading && <div className="text-center text-white/50 py-4">Cargando…</div>}
          {!loading && users.length === 0 && (
            <div className="text-center text-white/50 py-4">Sin resultados.</div>
          )}
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white truncate">{u.email}</div>
                  <div className="text-xs text-white/40">
                    {u.name || "—"} · alta {new Date(u.createdAt).toLocaleDateString("es-ES")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg font-bold text-white">{u.credits}</div>
                  <div className="text-[10px] text-white/40">créditos</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "admin" ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" : "bg-white/5 text-white/60 border border-white/10"}`}>
                  {u.role}
                </span>
                {u.isPremium && (
                  <span className="rounded-full px-2 py-0.5 text-xs bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30">
                    ✓ Premium
                  </span>
                )}
                {u.emailNotifications && <span className="rounded-full px-2 py-0.5 text-xs bg-white/5 text-white/60 border border-white/10">📧</span>}
                {u.telegramChatId && u.telegramNotifications && <span className="rounded-full px-2 py-0.5 text-xs bg-white/5 text-white/60 border border-white/10">📨</span>}
                {u._count.purchases > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-xs bg-white/5 text-white/60 border border-white/10">
                    {u._count.purchases} compras
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => adjustCredits(u)}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-white/80 active:bg-white/10"
                >
                  ± créditos
                </button>
                <button
                  onClick={() =>
                    patchUser(
                      u.id,
                      { isPremium: !u.isPremium },
                      `${!u.isPremium ? "premium ON" : "premium OFF"} → ${u.email}`,
                    )
                  }
                  className={`rounded-lg px-2 py-2 text-xs active:opacity-70 ${
                    u.isPremium
                      ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30"
                      : "bg-white/5 text-white/70 border border-white/10"
                  }`}
                >
                  {u.isPremium ? "Quitar prem." : "Hacer prem."}
                </button>
                <button
                  onClick={() =>
                    patchUser(
                      u.id,
                      { role: u.role === "admin" ? "user" : "admin" },
                      `rol → ${u.role === "admin" ? "user" : "admin"} · ${u.email}`,
                    )
                  }
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-white/80 active:bg-white/10"
                >
                  {u.role === "admin" ? "→ user" : "→ admin"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Vista ESCRITORIO: tabla ────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-xs text-white/60 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Email · Nombre</th>
                <th className="px-3 py-2 text-right">Créditos</th>
                <th className="px-3 py-2 text-center">Rol</th>
                <th className="px-3 py-2 text-center">Premium</th>
                <th className="px-3 py-2 text-center">Notif</th>
                <th className="px-3 py-2 text-center">Compras</th>
                <th className="px-3 py-2 text-left">Alta</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-white/50" colSpan={8}>
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-white/50" colSpan={8}>
                    Sin resultados.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <div className="text-white truncate max-w-[240px]">{u.email}</div>
                    <div className="text-xs text-white/40">{u.name || "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-white">{u.credits}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={u.role === "admin" ? "text-amber-300" : "text-white/70"}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() =>
                        patchUser(
                          u.id,
                          { isPremium: !u.isPremium },
                          `${!u.isPremium ? "premium ON" : "premium OFF"} → ${u.email}`,
                        )
                      }
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.isPremium
                          ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30"
                          : "bg-white/5 text-white/50 border border-white/10 hover:text-white"
                      }`}
                    >
                      {u.isPremium ? "✓ Premium" : "user"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-white/50">
                    {u.emailNotifications && <span title="email">📧</span>}
                    {u.telegramChatId && u.telegramNotifications && <span title="telegram">📨</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-white/60">{u._count.purchases}</td>
                  <td className="px-3 py-2 text-xs text-white/50">
                    {new Date(u.createdAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => adjustCredits(u)}
                      className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      ± créditos
                    </button>
                    <button
                      onClick={() =>
                        patchUser(
                          u.id,
                          { role: u.role === "admin" ? "user" : "admin" },
                          `rol → ${u.role === "admin" ? "user" : "admin"} · ${u.email}`,
                        )
                      }
                      className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      {u.role === "admin" ? "→ user" : "→ admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="mt-3 flex items-center justify-between text-xs text-white/50">
            <div>
              Mostrando {offset + 1}–{Math.min(offset + limit, total)} de {total}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/50">{sub}</div>}
    </div>
  );
}
