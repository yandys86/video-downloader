import type { Metadata } from "next";
import PlatformLanding from "@/components/PlatformLanding";

export const metadata: Metadata = {
  title: "Descargar videos de Facebook y FB Watch gratis",
  description:
    "Baja videos de Facebook, FB Watch y Reels de Facebook en MP4 directo al dispositivo. Gratis, sin instalar nada, funciona en iPhone, Android, Mac y PC.",
  alternates: { canonical: "https://tuvideodown.com/facebook" }
};

export default function Page() {
  return (
    <PlatformLanding
      navActive="/facebook"
      badge="Facebook y FB Watch"
      heading="Descarga videos de Facebook"
      intro="Pega el enlace de un video de Facebook (incluyendo FB Watch y Reels de FB) y descargalo en MP4. Soporta enlaces facebook.com/watch, facebook.com/share/ y fb.watch."
      placeholder="https://www.facebook.com/watch?v=..."
      highlights={[
        "Soporta videos de feed, FB Watch, Reels de Facebook y enlaces compartidos /share/",
        "Calidades hasta 1080p cuando estan disponibles",
        "Salida en H.264 compatible con QuickTime e iPhone",
        "Opcion solo audio en m4a",
        "Sin login, sin extensiones, gratis"
      ]}
      faq={[
        {
          q: "Que enlaces de Facebook puedo usar?",
          a: "Sirven los enlaces de facebook.com/watch?v=..., los enlaces cortos fb.watch, los enlaces compartidos /share/v/ y /share/r/, y URLs de Reels de Facebook."
        },
        {
          q: "Por que algunos videos de Facebook no se pueden descargar?",
          a: "Si el video es de un grupo privado, de un perfil con login obligatorio o esta restringido por region, no se puede bajar. Solo funciona con contenido publico."
        },
        {
          q: "Hasta que calidad puedo bajar?",
          a: "Hasta 1080p si Facebook ofrece esa resolucion para ese video. La mayoria de los videos publicos tienen 720p o 1080p."
        },
        {
          q: "Puedo bajar solo el audio del video de Facebook?",
          a: "Si. Eligiendo Solo audio (m4a) descargas la pista de audio sin video."
        },
        {
          q: "Funciona con videos en vivo (live)?",
          a: "Solo si la transmision ya termino y quedo guardada en el perfil/pagina como video. Las transmisiones en curso no se descargan."
        }
      ]}
    />
  );
}
