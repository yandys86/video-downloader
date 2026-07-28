/**
 * Sistema de créditos: descontar, añadir, verificar balance.
 * Todas las operaciones son atómicas y quedan registradas en credit_ledger.
 */

import { prisma } from "@/lib/prisma";

// Pricing: 1 crédito = ~15s de Reel.
// Redondeo hacia arriba: 20s = 2 créditos.
export function reelDurationToCredits(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / 15));
}

export type CreditReason =
  | "signup_bonus"
  | "purchase"
  | "reel_generate"
  | "reel_analyze"
  | "reel_quick_clip"
  | "admin_grant"
  | "admin_deduct"
  | "refund";

/** Añade créditos al balance y registra en el ledger. */
export async function addCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refId?: string,
): Promise<void> {
  if (amount === 0) return;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.creditLedger.create({
      data: { userId, amount, reason, refId },
    }),
  ]);
}

/**
 * Descuenta créditos si hay balance suficiente. Devuelve true si se
 * descontaron, false si no hay bastantes (no toca nada).
 *
 * Admin (role="admin") tiene bypass: siempre devuelve true sin
 * descontar y registra amount=0 en el ledger para auditoría.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refId?: string,
): Promise<{ ok: boolean; balance: number; wasAdmin: boolean }> {
  if (amount <= 0) return { ok: true, balance: 0, wasAdmin: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });
  if (!user) return { ok: false, balance: 0, wasAdmin: false };

  if (user.role === "admin") {
    // Bypass admin: registra amount=0 con refId para auditoría
    await prisma.creditLedger.create({
      data: {
        userId,
        amount: 0,
        reason,
        refId: refId ? `admin:${refId}` : "admin:bypass",
      },
    });
    return { ok: true, balance: user.credits, wasAdmin: true };
  }

  if (user.credits < amount) {
    return { ok: false, balance: user.credits, wasAdmin: false };
  }

  // Descuento atómico con guarda WHERE credits >= amount
  const updated = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  if (updated.count === 0) {
    // Race condition (otro request ya bajó por debajo)
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return { ok: false, balance: fresh?.credits ?? 0, wasAdmin: false };
  }
  await prisma.creditLedger.create({
    data: { userId, amount: -amount, reason, refId },
  });
  return { ok: true, balance: user.credits - amount, wasAdmin: false };
}

export async function getBalance(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return u?.credits ?? 0;
}
