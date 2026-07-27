import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { SIGNUP_BONUS_CREDITS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "yandys.alfonso86@gmail.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = body.name ? String(body.name).trim().slice(0, 80) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Contraseña mínima: 8 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const role = ADMIN_EMAILS.has(email) ? "admin" : "user";

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          name,
          passwordHash: hash,
          role,
          credits: SIGNUP_BONUS_CREDITS,
        },
      });
      await tx.creditLedger.create({
        data: { userId: u.id, amount: SIGNUP_BONUS_CREDITS, reason: "signup_bonus" },
      });
      return u;
    });

    return NextResponse.json({ ok: true, id: user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}
