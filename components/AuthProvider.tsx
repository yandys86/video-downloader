"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  // refetchOnWindowFocus: en iOS Safari se dispara con muchísima frecuencia
  // (touch, gestures) y provoca update() en cadena que hace parpadear los
  // componentes que usan useSession(). Lo apagamos; el refresco de saldo
  // se hace explícitamente en UserBadge (mount) y PaidRefresher (tras compra).
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
