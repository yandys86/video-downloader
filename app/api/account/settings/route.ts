/**
 * Ajustes del user (por ahora: emailNotifications on/off).
 * PATCH body: { emailNotifications?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: { emailNotifications?: boolean; telegramNotifications?: boolean } = {};
  if (typeof body.emailNotifications === "boolean") {
    data.emailNotifications = body.emailNotifications;
  }
  if (typeof body.telegramNotifications === "boolean") {
    data.telegramNotifications = body.telegramNotifications;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { emailNotifications: true, telegramNotifications: true },
  });
  return NextResponse.json({ ok: true, ...updated });
}
