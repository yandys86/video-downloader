import type { Metadata } from "next";
import PlatformLanding from "@/components/PlatformLanding";

export const metadata: Metadata = {
  title: "Descargar videos de TikTok sin marca de agua gratis",
  description:
    "Baja videos de TikTok en MP4 sin marca de agua cuando esta disponible. Tambien podes extraer solo el audio. Gratis, sin instalar nada, funciona en iPhone, Android, Mac y PC.",
  alternates: { canonical: "https://tuvideodown.com/tiktok" }
};

export default function Page() {
  return (
    <PlatformLanding
      navActive="/tiktok"
      badge="TikTok sin marca de agua"
      heading="Descarga videos de TikTok sin marca de agua"
      intro="Pega el enlace de un TikTok y bajalo en MP4 sin watermark cuando la plataforma sirve esa version. Tambien podes descargar solo el audio del video."
      placeholder="https://www.tiktok.com/@usuario/video/..."
      highlights={[
        "Descarga sin marca de agua cuando esta disponible",
        "Soporta enlaces tiktok.com y vm.tiktok.com",
        "Opcion solo audio en m4a, util para tendencias y sonidos virales",
        "Funciona desde iPhone y Android directo al navegador",
        "Sin login, sin extensiones, gratis"
      ]}
      faq={[
        {
          q: "Como descargo un TikTok sin marca de agua?",
          a: "Copia el enlace del video desde la app de TikTok (Share -> Copiar enlace) o desde el navegador, pegalo aca y elegi la calidad. Cuando la version sin watermark esta disponible se baja sin marca."
        },
        {
          q: "Siempre se descarga sin marca de agua?",
          a: "Casi siempre. Algunos videos viejos o de cuentas con restricciones solo tienen la version con watermark publicada; en esos casos se descarga esa version."
        },
        {
          q: "Puedo bajar solo la musica del TikTok?",
          a: "Si. Seleccionando Solo audio (m4a) descargas la pista de audio sin video. Ideal para sonidos virales o si queres usar el audio en otros lugares."
        },
        {
          q: "Funciona con enlaces vm.tiktok.com cortos?",
          a: "Si. Se aceptan los enlaces cortos vm.tiktok.com y los enlaces completos tiktok.com/@usuario/video/."
        },
        {
          q: "Puedo bajar videos de cuentas privadas?",
          a: "No. Solo funciona con videos publicos. Si la cuenta es privada o el video fue eliminado no se puede descargar."
        }
      ]}
    />
  );
}
