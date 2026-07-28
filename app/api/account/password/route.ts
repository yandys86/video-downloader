/**
 * Cambio de contraseña. Requiere la actual (excepto para users OAuth-only
 * que están estableciendo una password por primera vez).
 * Body: { current?: string, next: string }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sess = await getSessionUser();
  if (!sess) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const next: string = String(body.next || "");
  const current: string | undefined = body.current;
  if (next.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener 8+ caracteres" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sess.id },
    select: { passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Si ya tiene password, hay que verificar la actual antes de cambiar.
  if (user.passwordHash) {
    if (!current) {
      return NextResponse.json({ error: "Debes indicar tu contraseña actual" }, { status: 400 });
    }
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: sess.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
