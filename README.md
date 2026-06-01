# Video Downloader

Aplicacion web tipo "uno-pega-link / uno-descarga" para bajar videos de las principales redes sociales directo al dispositivo del usuario.

Plataformas soportadas:

- YouTube (videos y shorts)
- TikTok (sin marca de agua cuando es posible)
- Instagram (Reels y posts publicos)
- Twitter / X
- Facebook

Construido con **Next.js 14 (App Router) + TypeScript + Tailwind** y **yt-dlp** corriendo en el servidor. El video se *streamea* directamente al navegador con `Content-Disposition: attachment`, por lo que se guarda en la carpeta de descargas del dispositivo que este usando el usuario en ese momento (PC, Mac, telefono, tablet).

---

## Requisitos del sistema

Antes de instalar las dependencias de npm, necesitas tener en tu maquina:

1. **Node.js >= 18** (recomendado 20 LTS)
2. **yt-dlp** en el `PATH`
3. **ffmpeg** en el `PATH` (necesario para mezclar video + audio en MP4)

### En macOS (recomendado con Homebrew)

```bash
# 1) Instalar Homebrew si no lo tienes
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2) Instalar Node, yt-dlp y ffmpeg
brew install node yt-dlp ffmpeg
```

### En Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y nodejs npm ffmpeg python3-pip
sudo pip3 install -U yt-dlp
```

### En Windows

- Instala Node.js desde https://nodejs.org
- Instala yt-dlp desde https://github.com/yt-dlp/yt-dlp/releases (anade el .exe al PATH)
- Instala ffmpeg desde https://www.gyan.dev/ffmpeg/builds/ (anade `bin/` al PATH)

Verifica que todo este disponible:

```bash
node --version
yt-dlp --version
ffmpeg -version
```

---

## Instalacion del proyecto

```bash
cd video_downloader
npm install
```

## Correr en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## Build de produccion

```bash
npm run build
npm run start
```

---

## Como funciona

- **`/api/info`** recibe la URL, detecta la plataforma y llama a `yt-dlp --dump-json` para obtener metadatos (titulo, miniatura, duracion, formatos).
- **`/api/download`** spawnea `yt-dlp` con el selector de formato elegido y `-o -`, conectando `stdout` a un `ReadableStream` que se entrega al navegador. El navegador, al recibir `Content-Disposition: attachment`, dispara la descarga al disco del dispositivo.
- El frontend ([app/page.tsx](app/page.tsx)) es un cliente React simple con autodeteccion de plataforma y selector de calidad.

## Variables de entorno opcionales

| Variable        | Descripcion                                                |
|-----------------|------------------------------------------------------------|
| `YT_DLP_PATH`   | Ruta al ejecutable `yt-dlp` si no esta en el `PATH`.        |

## Estructura

```
app/
  api/
    info/route.ts        # POST -> metadatos del video
    download/route.ts    # GET  -> stream del binario al cliente
  layout.tsx
  page.tsx               # UI principal
  globals.css
lib/
  platforms.ts           # Detector de plataforma + utilidades
```

## Notas

- No se persiste nada en disco del servidor: la descarga viaja directamente al usuario.
- Para videos protegidos (Instagram privado, etc.) yt-dlp puede requerir cookies; queda fuera del alcance de esta version.
- Uso personal. Respeta los terminos de servicio y derechos de autor de cada plataforma.
