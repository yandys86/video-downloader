import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtPrice } from "@/lib/pricing";
import { isTelegramConfigured } from "@/lib/telegram";
import { isEmailConfigured } from "@/lib/email";
import TelegramConnect from "@/components/TelegramConnect";
import EmailNotificationsToggle from "@/components/EmailNotificationsToggle";
import ProfileEditor from "@/components/ProfileEditor";
import PaidRefresher from "@/components/PaidRefresher";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { paid?: string; pack?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      credits: true,
      role: true,
      createdAt: true,
      passwordHash: true,
      telegramChatId: true,
      telegramNotifications: true,
      emailNotifications: true,
    },
  });

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { provider: true },
  });
  const loginProviders = [
    ...new Set([
      ...accounts.map((a) => a.provider),
      ...(user?.passwordHash ? ["credentials"] : []),
    ]),
  ];

  const [ledger, purchases] = await Promise.all([
    prisma.creditLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.purchase.findMany({
      where: { userId: session.user.id, status: "paid" },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {searchParams.paid && (
        <>
          <PaidRefresher />
          <div className="mb-6 rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-100">
            <div className="font-medium">✓ Pago recibido</div>
            <div className="text-xs text-green-200/80">Los créditos se acreditan en 1-3 segundos, refrescando…</div>
          </div>
        </>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Tu cuenta</h1>
        <p className="mt-1 text-sm text-white/60">{user?.email}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 p-5">
          <div className="text-xs uppercase tracking-wide text-white/50">Créditos</div>
          <div className="mt-1 text-4xl font-bold text-white">
            {user?.role === "admin" ? "∞" : user?.credits ?? 0}
          </div>
          {user?.role === "admin" ? (
            <div className="mt-2 text-xs text-amber-200">Admin — uso ilimitado</div>
          ) : (
            <Link href="/pricing" className="mt-3 inline-block rounded bg-fuchsia-500/20 px-3 py-1 text-xs text-fuchsia-200 hover:bg-fuchsia-500/30">
              Comprar más
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-white/50">Rol</div>
          <div className="mt-1 text-2xl font-semibold text-white">{user?.role}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-white/50">Miembro desde</div>
          <div className="mt-1 text-lg text-white">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-ES") : "-"}
          </div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">Perfil</h2>
        <ProfileEditor
          initialName={user?.name || ""}
          email={user?.email || ""}
          hasPassword={!!user?.passwordHash}
          loginProviders={loginProviders}
        />
      </section>

      {(isTelegramConfigured() || isEmailConfigured()) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-white">Notificaciones</h2>
          <div className="space-y-3">
            {isEmailConfigured() && user?.email && (
              <EmailNotificationsToggle
                initial={user.emailNotifications ?? true}
                email={user.email}
              />
            )}
            {isTelegramConfigured() && (
              <TelegramConnect
                connected={!!user?.telegramChatId}
                currentChatId={user?.telegramChatId}
                notificationsEnabled={user?.telegramNotifications ?? true}
              />
            )}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">Últimos movimientos</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-white/50">Sin movimientos aún.</p>
        ) : (
          <ul className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <div className="text-white">{l.reason.replace(/_/g, " ")}</div>
                  <div className="text-xs text-white/40">
                    {new Date(l.createdAt).toLocaleString("es-ES")}
                    {l.refId && ` · ${l.refId.slice(0, 10)}…`}
                  </div>
                </div>
                <div className={l.amount >= 0 ? "text-emerald-300" : "text-red-300"}>
                  {l.amount > 0 ? "+" : ""}
                  {l.amount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {purchases.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Compras</h2>
          <ul className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <div className="text-white">{p.credits} créditos · {p.provider}</div>
                  <div className="text-xs text-white/40">{p.paidAt ? new Date(p.paidAt).toLocaleString("es-ES") : ""}</div>
                </div>
                <div className="text-white/70">{fmtPrice(p.amountCents)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
