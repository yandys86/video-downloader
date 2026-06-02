import type { Metadata } from "next";
import PlatformLanding from "@/components/PlatformLanding";

export const metadata: Metadata = {
  title: "Descargar videos de YouTube y Shorts en MP4 gratis",
  description:
    "Descarga videos de YouTube y YouTube Shorts en MP4 hasta 1080p, o solo el audio en m4a. Sin instalar nada, gratis, funciona en iPhone, Android, Mac y PC.",
  alternates: { canonical: "https://tuvideodown.com/youtube" }
};

export default function Page() {
  return (
    <PlatformLanding
      navActive="/youtube"
      badge="YouTube y YouTube Shorts"
      heading="Descarga videos de YouTube y Shorts"
      intro="Pega el enlace de un video o Short de YouTube, elegi la calidad (hasta 1080p) y descargalo directo al dispositivo. Tambien podes bajar solo el audio en m4a."
      placeholder="https://www.youtube.com/watch?v=..."
      highlights={[
        "Soporta YouTube clasico y YouTube Shorts",
        "Calidades 360p, 480p, 720p y 1080p cuando estan disponibles",
        "Opcion solo audio en formato m4a (AAC)",
        "Salida en H.264 + AAC compatible con QuickTime, iPhone y Android",
        "Sin marca de agua, sin login, sin instalar nada"
      ]}
      faq={[
        {
          q: "Como descargo un video de YouTube?",
          a: "Copia el enlace del video desde la app o el navegador, pegalo en el campo de arriba, elegi la calidad y toca Descargar al dispositivo. El archivo se guarda como MP4 en la carpeta de descargas."
        },
        {
          q: "Funciona con YouTube Shorts?",
          a: "Si. Los Shorts se procesan igual que los videos largos. Pega la URL del Short y elegi la calidad."
        },
        {
          q: "Hasta que resolucion puedo bajar?",
          a: "Hasta 1080p cuando la plataforma sirve esa resolucion para ese video. Algunos videos solo estan disponibles en menor calidad, en ese caso el descargador usa la mejor opcion disponible."
        },
        {
          q: "Puedo descargar solo el audio?",
          a: "Si. Seleccionando la opcion Solo audio (m4a) descargas la pista de audio sin video. Util para podcasts, musica o entrevistas."
        },
        {
          q: "Es legal descargar videos de YouTube?",
          a: "El servicio esta pensado para uso personal sobre contenido del que tengas derechos o que sea de tu propia autoria. Respetar los terminos de servicio de YouTube y los derechos de autor es responsabilidad del usuario."
        }
      ]}
    />
  );
}
