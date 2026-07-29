"use client";

import { useEffect, useState } from "react";

type OS = "ios" | "android" | "other";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export default function WatchInstructions() {
  const [os, setOs] = useState<OS>("other");

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const items: Record<OS, { title: string; steps: string[] }> = {
    ios: {
      title: "📱 Cómo guardar en Fotos (iPhone)",
      steps: [
        "Toca «Guardar en galería» — se abre el menú compartir de iOS",
        "En el menú, toca «Guardar vídeo»",
        "El Reel aparecerá en tu app Fotos en unos segundos",
        "Alternativa: mantén pulsado sobre el vídeo del player → «Guardar en Fotos»",
      ],
    },
    android: {
      title: "📱 Cómo guardar en Galería (Android)",
      steps: [
        "Toca «Guardar en galería» — se abre el menú compartir",
        "Elige «Fotos», «Galería» o «Guardar vídeo»",
        "Si tu navegador no soporta compartir, usa «Descargar como fichero» — el Reel aparecerá en el álbum Descargas de tu galería",
      ],
    },
    other: {
      title: "💻 Guardar en tu ordenador",
      steps: [
        "Toca «Descargar como fichero» — se guarda en tu carpeta de Descargas",
        "También puedes hacer clic derecho sobre el vídeo → «Guardar vídeo como…»",
      ],
    },
  };

  const cfg = items[os];

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-sm font-medium text-white mb-2">{cfg.title}</div>
      <ol className="ml-4 list-decimal space-y-1.5 text-sm text-white/70">
        {cfg.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
