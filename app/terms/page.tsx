import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos de uso",
  description:
    "Terminos del servicio de TuVideoDown: uso personal, contenido publico, derechos de autor y limites de responsabilidad.",
  alternates: { canonical: "https://tuvideodown.com/terms" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terminos de uso</h1>
      <p className="mt-2 text-sm text-white/50">Ultima actualizacion: 2026-06-03</p>

      <section className="mt-8 space-y-4 text-white/80 leading-relaxed">
        <p>
          Al usar TuVideoDown aceptas los terminos descritos a continuacion. Si
          no estas de acuerdo, por favor no uses el servicio.
        </p>

        <h2 className="text-xl font-semibold mt-6">1. Uso personal</h2>
        <p>
          El servicio se ofrece exclusivamente para uso personal y no
          comercial. Esta pensado para descargar videos sobre los que tengas
          derechos, contenido de tu autoria, o material disponible bajo una
          licencia que permita la descarga.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Contenido publico</h2>
        <p>
          Solo se pueden descargar videos publicos. No se soportan cuentas
          privadas, contenido con login obligatorio, stories de Instagram,
          transmisiones en vivo en curso, ni material protegido por DRM.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Derechos de autor</h2>
        <p>
          Vos sos responsable de respetar los derechos de autor del contenido
          que descargues. No deberias redistribuir, monetizar ni hacer
          downloads masivos de material que no te pertenezca. Tampoco deberias
          violar los terminos de servicio de las plataformas de origen
          (YouTube, TikTok, Instagram, Twitter/X, Facebook).
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Sin garantia</h2>
        <p>
          El servicio se ofrece "tal cual" (as-is). Las plataformas de origen
          cambian sus APIs y formatos frecuentemente, por lo que algunas
          descargas pueden fallar temporalmente. Hacemos lo posible para
          mantenerlo funcionando, pero no garantizamos disponibilidad
          permanente ni que cualquier video pueda descargarse.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Limite de responsabilidad</h2>
        <p>
          TuVideoDown no es responsable por daños directos o indirectos
          derivados del uso del servicio. No somos responsables por el uso que
          le des al contenido descargado.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. Anuncios y afiliados</h2>
        <p>
          El servicio puede mostrar anuncios y enlaces de afiliados para
          cubrir los costos de infraestructura. No respaldamos
          individualmente cada anuncio y los anuncios pueden cambiar segun el
          contexto. Mira la{" "}
          <a className="text-violet-300 hover:text-violet-200 underline" href="/privacy">
            politica de privacidad
          </a>{" "}
          para detalles sobre cookies.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Modificaciones</h2>
        <p>
          Podemos actualizar estos terminos en cualquier momento. La version
          vigente es la publicada en esta pagina con la fecha de actualizacion.
        </p>

        <h2 className="text-xl font-semibold mt-6">8. Contacto</h2>
        <p>
          Para reportes, consultas o solicitudes legales (incluyendo DMCA),
          abri un issue en el{" "}
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
      </section>
    </main>
  );
}
