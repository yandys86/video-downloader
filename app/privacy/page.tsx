import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de privacidad",
  description:
    "Como TuVideoDown trata tu informacion: que datos procesamos, que cookies usamos y como ejercer tus derechos.",
  alternates: { canonical: "https://tuvideodown.com/privacy" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16 prose-invert">
      <h1 className="text-3xl font-bold tracking-tight">Politica de privacidad</h1>
      <p className="mt-2 text-sm text-white/50">Ultima actualizacion: 2026-06-03</p>

      <section className="mt-8 space-y-4 text-white/80 leading-relaxed">
        <p>
          TuVideoDown es un servicio gratuito para descargar videos publicos de
          YouTube, TikTok, Instagram, Twitter/X y Facebook. Esta pagina explica
          que informacion procesamos y como la usamos.
        </p>

        <h2 className="text-xl font-semibold mt-6">1. Datos que procesamos</h2>
        <p>
          No requerimos registro ni cuenta. Solo procesamos lo siguiente:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>URLs que pegas:</strong> se envian a nuestro servidor para
            extraer la informacion del video y servirte la descarga. No las
            guardamos despues de que la descarga termina.
          </li>
          <li>
            <strong>Logs del servidor:</strong> direccion IP, user-agent y URL
            solicitada. Se usan para diagnosticar problemas y proteger contra
            abuso. Se rotan periodicamente.
          </li>
          <li>
            <strong>No almacenamos</strong> los videos descargados. La descarga
            se hace en streaming desde el origen al navegador.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">2. Cookies y publicidad</h2>
        <p>
          Este sitio puede mostrar anuncios de Google AdSense y banners de
          programas de afiliados. Estos servicios pueden usar cookies para
          personalizar anuncios:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Google usa la cookie DART y otras para servir anuncios basados en
            tus visitas a este y otros sitios.
          </li>
          <li>
            Podes desactivar la cookie DART visitando la{" "}
            <a
              className="text-violet-300 hover:text-violet-200 underline"
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener nofollow"
            >
              politica de anuncios y privacidad de Google
            </a>
            .
          </li>
          <li>
            Programas de afiliados (por ejemplo VPN) pueden registrar que
            hiciste clic en su link para reconocer la conversion. No comparten
            datos personales con nosotros.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">3. Terceros</h2>
        <p>
          Cuando descargas un video, el contenido proviene directamente de la
          plataforma de origen (YouTube, TikTok, Instagram, etc.) y se aplica
          tambien la politica de esa plataforma.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Tus derechos</h2>
        <p>
          Podes solicitar acceso, rectificacion o eliminacion de cualquier
          informacion que tengamos sobre vos escribiendo a traves del{" "}
          <a
            className="text-violet-300 hover:text-violet-200 underline"
            href="https://github.com/yandys86/video-downloader/issues"
            target="_blank"
            rel="noopener nofollow"
          >
            repositorio de GitHub
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Cambios</h2>
        <p>
          Si actualizamos esta politica, publicamos la nueva version en esta
          misma pagina con la fecha de actualizacion.
        </p>
      </section>
    </main>
  );
}
