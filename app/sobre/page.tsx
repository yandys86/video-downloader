import type { Metadata } from "next";
import Footer from "@/components/Footer";
import PlatformNav from "@/components/PlatformNav";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description: "Qué es TuVideoDown, para qué sirve y nuestro compromiso con el uso responsable."
};

export default function Sobre() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300">
          Sobre TuVideoDown
        </h1>
      </header>

      <PlatformNav active="/sobre" />

      <div className="space-y-4 text-white/75 leading-relaxed">
        <p>
          TuVideoDown nació para resolver algo muy concreto: poder guardar un video público de las
          redes sociales en el dispositivo, de forma rápida, gratuita y sin tener que instalar
          programas raros ni extensiones del navegador.
        </p>
        <p>
          Somos un equipo pequeño que cree en las herramientas simples y útiles. Por eso el sitio se
          centra en una sola cosa y la hace bien: pegas un enlace, eliges la calidad y descargas un
          MP4 estándar que funciona en cualquier teléfono, computadora o televisor.
        </p>
        <h2 className="text-xl font-bold text-white/90 mt-6">Nuestro compromiso</h2>
        <p>
          Creemos en el uso responsable. TuVideoDown solo permite descargar contenido público y está
          pensado para fines personales: ver sin conexión, ahorrar datos o respaldar tu propio
          material. Pedimos a nuestros usuarios que respeten siempre los derechos de autor de los
          creadores y los términos de cada plataforma.
        </p>
        <h2 className="text-xl font-bold text-white/90 mt-6">¿Tienes una sugerencia?</h2>
        <p>
          Nos encanta mejorar con las ideas de la gente. Escríbenos desde la{" "}
          <a href="/contacto" className="text-violet-300 hover:text-violet-200 underline">página de contacto</a>{" "}
          y lo leeremos.
        </p>
      </div>

      <Footer />
    </main>
  );
}
