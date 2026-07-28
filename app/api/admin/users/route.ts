/**
 * GET /api/admin/users?q=email&limit=50&offset=0
 * Lista paginada de usuarios para el panel admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const where = q
    ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        credits: true,
        isPremium: true,
        emailNotifications: true,
        telegramNotifications: true,
        telegramChatId: true,
        createdAt: true,
        _count: { select: { purchases: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, limit, offset });
}
