import type { Metadata } from "next";
import PlatformLanding from "@/components/PlatformLanding";

export const metadata: Metadata = {
  title: "Descargar Reels y videos de Instagram gratis",
  description:
    "Baja Reels y videos publicos de Instagram en MP4 directo al dispositivo. Tambien podes descargar solo el audio. Gratis, sin login, sin instalar nada.",
  alternates: { canonical: "https://tuvideodown.com/instagram" }
};

export default function Page() {
  return (
    <PlatformLanding
      navActive="/instagram"
      badge="Reels y posts publicos"
      heading="Descarga Reels y videos de Instagram"
      intro="Pega el enlace de un Reel o un post de video publico y descargalo en MP4. Soporta enlaces /reel/ y /p/ de instagram.com."
      placeholder="https://www.instagram.com/reel/..."
      highlights={[
        "Soporta Reels y posts de video publicos",
        "Calidad original que sirve Instagram (tipicamente 720p o 1080p)",
        "Opcion solo audio en m4a",
        "Funciona desde iPhone, Android, Mac y PC",
        "Sin login, sin extensiones, gratis"
      ]}
      faq={[
        {
          q: "Como descargo un Reel de Instagram?",
          a: "Abri el Reel en Instagram, toca compartir y copia el enlace. Pegalo en el campo de arriba, elegi la calidad y toca Descargar al dispositivo."
        },
        {
          q: "Sirve para posts del feed que tienen video?",
          a: "Si. Funciona con enlaces /p/ que tengan un video adentro. Si el post es solo imagenes no hay nada para descargar."
        },
        {
          q: "Puedo descargar stories de Instagram?",
          a: "No. Las stories requieren autenticacion y caducan en 24 horas. Esta version solo soporta contenido publico permanente (Reels y posts)."
        },
        {
          q: "Funciona con cuentas privadas?",
          a: "No. Solo se pueden descargar videos de cuentas publicas. Si la cuenta es privada el video no es accesible desde fuera de la app."
        },
        {
          q: "Por que algunos Reels solo se descargan en una calidad?",
          a: "Instagram suele servir un unico stream por video. Si pediste 360p pero el original es 720p, te damos el 720p (mejor de bajar mas calidad que fallar)."
        }
      ]}
    />
  );
}
