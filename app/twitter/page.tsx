import type { Metadata } from "next";
import PlatformLanding from "@/components/PlatformLanding";

export const metadata: Metadata = {
  title: "Descargar videos de Twitter y X gratis",
  description:
    "Baja videos de Twitter / X en MP4 directo al dispositivo. Soporta enlaces twitter.com y x.com. Gratis, sin login, funciona en iPhone, Android, Mac y PC.",
  alternates: { canonical: "https://tuvideodown.com/twitter" }
};

export default function Page() {
  return (
    <PlatformLanding
      navActive="/twitter"
      badge="Twitter y X"
      heading="Descarga videos de Twitter / X"
      intro="Pega el enlace de un tweet con video y bajalo en MP4. Funciona con enlaces de twitter.com y x.com."
      placeholder="https://x.com/usuario/status/..."
      highlights={[
        "Soporta tweets de twitter.com y de x.com",
        "Mejor calidad disponible (tipicamente 720p o 1080p)",
        "Opcion solo audio en m4a",
        "Funciona desde iPhone, Android, Mac y PC",
        "Sin login, sin extensiones, gratis"
      ]}
      faq={[
        {
          q: "Como descargo un video de Twitter / X?",
          a: "Abri el tweet, copia el enlace (Share -> Copiar enlace al tweet), pegalo en el campo de arriba y toca Descargar al dispositivo."
        },
        {
          q: "Sirve para enlaces antiguos de twitter.com?",
          a: "Si. Aunque la red ahora se llama X, los enlaces twitter.com siguen redirigiendo. Ambos formatos funcionan."
        },
        {
          q: "Puedo descargar GIFs de Twitter?",
          a: "Los GIFs de Twitter en realidad son videos cortos MP4 sin audio, asi que se descargan como cualquier otro video."
        },
        {
          q: "Por que algunos tweets no se pueden bajar?",
          a: "Si el tweet es de una cuenta privada, fue eliminado o tiene restriccion de edad, no se puede descargar. Solo funciona con tweets publicos."
        },
        {
          q: "Funciona con Spaces o transmisiones en vivo?",
          a: "No. Spaces y livestreams no estan soportados, solo videos pre-grabados publicados en tweets."
        }
      ]}
    />
  );
}
