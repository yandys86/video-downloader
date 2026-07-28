"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Cuando /account se abre con ?paid=1 tras un Checkout de Stripe, el webhook
 * puede tardar 1-3s en escribir los créditos. Refrescamos:
 *   - session (JWT) → topbar coge nuevo saldo
 *   - router.refresh() → server component /account re-lee créditos
 * A los 2s y a los 5s. Después se detiene solo.
 */
export default function PaidRefresher() {
  const router = useRouter();
  const { update } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const tick = async () => {
      await update();
      router.refresh();
    };
    const t1 = setTimeout(tick, 2000);
    const t2 = setTimeout(tick, 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
