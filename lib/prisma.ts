/**
 * Cliente Prisma singleton — evita crear múltiples instancias en dev
 * (Next.js hot-reload) y en runtime serverless. Reusar la conexión
 * también es más eficiente en SQLite (menos locks).
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
