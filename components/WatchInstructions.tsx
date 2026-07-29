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
      title: "📱 Cómo guardar en tu galería (iPhone)",
      steps: [
        "Toca el botón ▶︎ para reproducir el vídeo",
        "Mantén el dedo pulsado sobre el vídeo",
        "En el menú, toca «Guardar en Fotos»",
        "Alternativa: usa el botón compartir del player → «Guardar vídeo»",
      ],
    },
    android: {
      title: "📱 Cómo guardar en tu galería (Android)",
      steps: [
        "Toca «Descargar como fichero» arriba",
        "El vídeo se guarda en la carpeta Descargas",
        "En tu app Galería, verás Descargas como álbum",
        "O usa el botón compartir del player → Guardar en Fotos",
      ],
    },
    other: {
      title: "💻 Guardar en tu ordenador",
      steps: [
        "Toca «Descargar como fichero» arriba",
        "Se guarda en tu carpeta de Descargas",
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
