import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 403 });

  const now = Date.now();
  const day = new Date(now - 24 * 60 * 60 * 1000);
  const week = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    users,
    admins,
    premium,
    telegramLinked,
    signupsLast7d,
    revenue,
    revenueLast7d,
    creditsSold,
    reelsLast24h,
    reelsLast7d,
    pendingPurchases,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { NOT: { telegramChatId: null } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.purchase.aggregate({ _sum: { amountCents: true }, where: { status: "paid" } }),
    prisma.purchase.aggregate({
      _sum: { amountCents: true },
      where: { status: "paid", paidAt: { gte: week } },
    }),
    prisma.purchase.aggregate({ _sum: { credits: true }, where: { status: "paid" } }),
    prisma.creditLedger.count({
      where: {
        createdAt: { gte: day },
        reason: { in: ["reel_generate", "reel_quick_clip"] },
      },
    }),
    prisma.creditLedger.count({
      where: {
        createdAt: { gte: week },
        reason: { in: ["reel_generate", "reel_quick_clip"] },
      },
    }),
    prisma.purchase.count({ where: { status: "pending" } }),
  ]);

  return NextResponse.json({
    users,
    admins,
    premium,
    telegramLinked,
    signupsLast7d,
    revenueCents: revenue._sum.amountCents || 0,
    revenueCentsLast7d: revenueLast7d._sum.amountCents || 0,
    creditsSold: creditsSold._sum.credits || 0,
    reelsLast24h,
    reelsLast7d,
    pendingPurchases,
  });
}
