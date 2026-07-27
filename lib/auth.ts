/**
 * NextAuth v4 config: Google OAuth + email/password (Credentials).
 * - Adapter Prisma para persistir users/accounts/sessions en SQLite.
 * - Admin auto-assign: los emails de ADMIN_EMAILS se marcan role="admin".
 * - Signup bonus: al crear cuenta se otorgan N créditos gratis y se
 *   registra en credit_ledger para auditoría.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

// Emails que se convierten en admin al registrarse.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "yandys.alfonso86@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

// Créditos gratis al registrarse (freemium).
export const SIGNUP_BONUS_CREDITS = Number(process.env.SIGNUP_BONUS_CREDITS ?? 5);

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "user" | "admin";
      credits: number;
    } & DefaultSession["user"];
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },   // JWT para no depender de session table en cada request
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true, // permite login con Google si ya hay cuenta email/password
    }),
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Asegurar que el user tiene el bonus de créditos al primer sign-in.
      // (Los que llegan por Credentials ya fueron creados en /api/auth/register
      // con el bonus. Los de OAuth se crean por el adapter sin bonus, hay que dárselo aquí.)
      if (user.email) {
        const email = user.email.toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });
        const shouldGrantBonus = existing && existing.credits === 0
          && (await prisma.creditLedger.count({
            where: { userId: existing.id, reason: "signup_bonus" },
          })) === 0;
        const shouldPromoteAdmin = existing && existing.role !== "admin" && ADMIN_EMAILS.has(email);
        if (shouldGrantBonus || shouldPromoteAdmin) {
          await prisma.$transaction(async (tx) => {
            if (shouldGrantBonus) {
              await tx.user.update({
                where: { id: existing!.id },
                data: { credits: { increment: SIGNUP_BONUS_CREDITS } },
              });
              await tx.creditLedger.create({
                data: {
                  userId: existing!.id,
                  amount: SIGNUP_BONUS_CREDITS,
                  reason: "signup_bonus",
                },
              });
            }
            if (shouldPromoteAdmin) {
              await tx.user.update({
                where: { id: existing!.id },
                data: { role: "admin" },
              });
            }
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // Refresca role + credits en el token cada vez que updateSession() se llama.
      if (user?.email) token.email = user.email;
      if (token.email && (trigger === "update" || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true, credits: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.credits = dbUser.credits;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) || "";
        session.user.role = (token.role as "user" | "admin") || "user";
        session.user.credits = (token.credits as number) ?? 0;
      }
      return session;
    },
  },
};
