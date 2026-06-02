import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://tuvideodown.com";
const SITE_NAME = "TuVideoDown";
const DESCRIPTION =
  "Descarga videos de YouTube, TikTok, Instagram, Twitter/X y Facebook directo a tu dispositivo. Gratis, sin instalar nada, sin marca de agua en TikTok. Funciona en iPhone, Android, Mac, PC.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Descargar videos de YouTube, TikTok, Instagram y mas | TuVideoDown",
    template: "%s | TuVideoDown"
  },
  description: DESCRIPTION,
  keywords: [
    "descargar videos",
    "descargar videos de YouTube",
    "descargar TikTok sin marca de agua",
    "descargar Reels de Instagram",
    "descargar videos de Facebook",
    "descargar videos de Twitter",
    "descargar videos de X",
    "bajar videos online",
    "video downloader",
    "descargar video gratis"
  ],
  authors: [{ name: SITE_NAME }],
  category: "technology",
  applicationName: SITE_NAME,
  alternates: {
    canonical: SITE_URL
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Descarga videos de YouTube, TikTok, Instagram, X y Facebook",
    description: DESCRIPTION,
    locale: "es_ES"
  },
  twitter: {
    card: "summary_large_image",
    title: "Descarga videos de YouTube, TikTok, Instagram, X y Facebook",
    description: DESCRIPTION
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b14"
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}#webapp`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Descarga videos de YouTube y Shorts",
        "Descarga TikTok sin marca de agua",
        "Descarga Reels y posts publicos de Instagram",
        "Descarga videos de Twitter/X",
        "Descarga videos de Facebook y FB Watch",
        "Solo audio en formato m4a",
        "Hasta 1080p cuando esta disponible"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Como descargo un video de YouTube?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Copia el enlace del video o Short de YouTube, pegalo en el campo, elegi la calidad y toca Descargar al dispositivo. El archivo se guarda en la carpeta de descargas de tu navegador."
          }
        },
        {
          "@type": "Question",
          name: "Puedo descargar TikTok sin marca de agua?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Si, cuando la version sin marca de agua esta disponible para el video, la descarga es directa sin watermark."
          }
        },
        {
          "@type": "Question",
          name: "Funciona en iPhone y Android?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Si. La descarga viaja desde el servidor al navegador como un archivo MP4 estandar, asi que tu telefono lo guarda en su carpeta de descargas sin instalar nada."
          }
        },
        {
          "@type": "Question",
          name: "Es gratis?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Si, el servicio es gratuito. No tenes que registrarte ni instalar extensiones."
          }
        },
        {
          "@type": "Question",
          name: "Puedo descargar videos privados o de cuentas con login?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Solo funciona con videos publicos. Instagram privado, paginas con login obligatorio o contenido protegido no se pueden bajar."
          }
        }
      ]
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
