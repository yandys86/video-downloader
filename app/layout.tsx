import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

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
  verification: {
    google: "UOuTNZoQmtXmOmcQaSIHuUVH7hZsXUsJtndpEP2FBHw"
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {ADSENSE_CLIENT && (
          <Script
            id="adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        )}
        {children}
      </body>
    </html>
  );
}
