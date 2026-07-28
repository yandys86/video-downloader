/**
 * PATCH /api/admin/users/:id
 * Body: { creditsDelta?: number, reason?: string,
 *         role?: "user"|"admin", isPremium?: boolean }
 *
 * - creditsDelta: entero positivo o negativo; se añade a User.credits y se registra en creditLedger.
 * - role: cambia el rol (admin no puede degradarse a sí mismo por accidente — bloqueamos self-demote).
 * - isPremium: activa watermark propio + animado.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "no autorizado" }, { status: 403 });

  const id = params.id;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const ops: string[] = [];

  // Ajuste de créditos
  if (typeof body.creditsDelta === "number" && body.creditsDelta !== 0) {
    if (!Number.isInteger(body.creditsDelta)) {
      return NextResponse.json({ error: "creditsDelta debe ser entero" }, { status: 400 });
    }
    const reason = body.creditsDelta > 0 ? "admin_grant" : "admin_deduct";
    await addCredits(id, body.creditsDelta, reason, `by:${admin.id}`);
    ops.push(`credits ${body.creditsDelta > 0 ? "+" : ""}${body.creditsDelta}`);
  }

  // Rol
  if (body.role === "user" || body.role === "admin") {
    if (id === admin.id && body.role !== target.role && body.role === "user") {
      return NextResponse.json({ error: "no puedes quitarte a ti mismo el rol admin" }, { status: 400 });
    }
    if (body.role !== target.role) {
      await prisma.user.update({ where: { id }, data: { role: body.role } });
      ops.push(`role=${body.role}`);
    }
  }

  // Premium
  if (typeof body.isPremium === "boolean") {
    await prisma.user.update({ where: { id }, data: { isPremium: body.isPremium } });
    ops.push(`isPremium=${body.isPremium}`);
  }

  const fresh = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, credits: true, isPremium: true },
  });
  return NextResponse.json({ ok: true, ops, user: fresh });
}
