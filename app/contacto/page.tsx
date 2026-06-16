import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Cómo contactar con el equipo de TuVideoDown."
};

// Cambia este correo por el buzón real del dominio (tuvideodown.com).
const CONTACT_EMAIL = "contacto@tuvideodown.com";

export default function Contacto() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Contacto
        </h1>
      </header>

      <PlatformNav active="/contacto" />

      <div className="space-y-4 text-white/75 leading-relaxed">
        <p>
          ¿Tienes una duda, una sugerencia o quieres reportar un problema? Estamos para ayudarte.
          Escríbenos y te responderemos lo antes posible.
        </p>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm text-white/50">Correo electrónico</div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lg text-violet-300 hover:text-violet-200">
            {CONTACT_EMAIL}
          </a>
        </div>
        <p className="text-sm text-white/60">
          Para solicitudes relacionadas con derechos de autor o retirada de contenido, indícanos el
          enlace concreto y el motivo, y lo revisaremos.
        </p>
      </div>

      <Footer />
    </main>
  );
}
