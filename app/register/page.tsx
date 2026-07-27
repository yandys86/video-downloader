"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear cuenta");
        setLoading(false);
        return;
      }
      // Login automático tras registrar
      const login = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (login?.error) {
        router.push("/login");
        return;
      }
      router.push("/shorts");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Error");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-2xl font-bold text-white">Crear cuenta gratis</h1>
        <p className="mt-1 text-sm text-white/60">Te regalamos <strong className="text-fuchsia-300">5 créditos</strong> para probar (~2 Reels).</p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/shorts" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] py-3 text-sm text-white hover:border-white/30"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.5 30.4 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.5-.1-3-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7C43.8 37.6 46.5 31.6 46.5 24.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7L2.6 13.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
          </svg>
          Registrarse con Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-white/40">
          <div className="h-px flex-1 bg-white/10" /> o email <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (opcional)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/30 focus:border-violet-400 outline-none"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/30 focus:border-violet-400 outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Contraseña (mínimo 8 caracteres)"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/30 focus:border-violet-400 outline-none"
          />
          {error && <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/60">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-violet-300 hover:text-violet-200 underline">
            Entra
          </Link>
        </p>
      </div>
    </main>
  );
}
