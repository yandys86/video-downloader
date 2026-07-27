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
