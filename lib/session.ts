/**
 * Helper para obtener la sesión del user desde API routes.
 * Devuelve null si no hay sesión (para 401).
 */

import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionUser(): Promise<Session["user"] | null> {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

/** Como getSessionUser pero devuelve null si el user no es admin. */
export async function getAdminUser(): Promise<Session["user"] | null> {
  const u = await getSessionUser();
  if (!u || u.role !== "admin") return null;
  return u;
}
