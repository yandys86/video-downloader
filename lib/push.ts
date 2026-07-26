/**
 * Web Push subscribe flow (frontend).
 * - Registra el Service Worker
 * - Pide permiso de notificación
 * - Obtiene VAPID public key del backend
 * - Suscribe al navegador al servicio de push
 * - Envía la subscription al backend, asociándola al job_id
 */

let vapidKeyCache: string | null = null;

async function getVapidKey(): Promise<string | null> {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const res = await fetch("/api/shorts/push/public_key");
    if (!res.ok) return null;
    const data = await res.json();
    vapidKeyCache = data.public_key || null;
    return vapidKeyCache;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Devuelve `true` si el navegador soporta Web Push. */
export function isPushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

/**
 * Suscribe al usuario a Web Push y asocia la subscription al job_id.
 * Idempotente (si ya está suscrito reutiliza la subscription).
 * Devuelve true si la subscription se registró OK.
 */
export async function subscribeToPushForJob(jobId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  // Permiso
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return false;
    }
  }
  if (perm !== "granted") return false;

  // Service Worker
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  } catch {
    return false;
  }

  // VAPID key
  const vapid = await getVapidKey();
  if (!vapid) return false;

  // Subscribe (o reutilizar existente)
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    } catch {
      return false;
    }
  }

  // Registrar en el backend con el job_id
  try {
    const res = await fetch("/api/shorts/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), job_id: jobId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Heurística: iOS Safari (fuera de standalone) NO recibe pushes hasta
 * que la app se instala vía "Añadir a pantalla de inicio". Devuelve
 * `true` si estamos en esa situación (para mostrar hint al usuario).
 */
export function needsPWAInstallOnIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (!isIOS) return false;
  const isStandalone = (window.matchMedia?.("(display-mode: standalone)")?.matches)
    || (window.navigator as any).standalone === true;
  return !isStandalone;
}
