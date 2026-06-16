// Contenido editorial original (guías). Texto propio para aportar valor real al sitio.

export type Block = { h2: string } | { p: string } | { ul: string[] };

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  blocks: Block[];
}

export const POSTS: Post[] = [
  {
    slug: "como-descargar-videos-instagram-sin-perder-calidad",
    title: "Cómo descargar videos de Instagram sin perder calidad",
    description:
      "Guía paso a paso para guardar Reels y publicaciones públicas de Instagram en MP4 manteniendo la mejor calidad posible.",
    date: "2026-06-10",
    blocks: [
      { p: "Instagram comprime los videos para que carguen rápido dentro de la app, pero cuando quieres guardar un Reel o una publicación para verla después conviene conservar la mayor calidad posible. En esta guía te explicamos cómo hacerlo de forma sencilla y qué tener en cuenta para no terminar con un archivo borroso." },
      { h2: "Paso a paso" },
      { ul: [
        "Abre Instagram y entra en el Reel o la publicación que quieres guardar.",
        "Toca el menú (los tres puntos) y elige \"Copiar enlace\".",
        "Pega ese enlace en el campo de TuVideoDown y pulsa Descargar.",
        "Elige la calidad más alta disponible (por ejemplo 1080p) y guarda el MP4."
      ] },
      { h2: "Consejos para mantener la calidad" },
      { p: "La calidad final nunca puede ser mayor que la del video original subido por su autor. Si el creador lo publicó en 720p, esa será la resolución máxima que podrás obtener. Por eso, cuando puedas elegir, selecciona siempre la resolución más alta que aparezca." },
      { p: "Evita volver a comprimir el archivo con otras apps después de descargarlo: cada recompresión resta nitidez. Guarda el MP4 tal cual y reprodúcelo con cualquier reproductor estándar." },
      { h2: "Qué se puede y qué no" },
      { p: "Solo es posible descargar contenido público. Las cuentas privadas, las stories que requieren inicio de sesión o el contenido con restricciones no se pueden obtener. Recuerda además usar los videos solo para fines personales y respetar los derechos del creador original." }
    ]
  },
  {
    slug: "que-es-el-formato-mp4",
    title: "¿Qué es el formato MP4 y por qué es el más compatible?",
    description:
      "Explicamos qué es un archivo MP4, por qué funciona en casi todos los dispositivos y cuándo conviene descargar solo el audio.",
    date: "2026-06-08",
    blocks: [
      { p: "Cuando descargas un video casi siempre lo recibes en formato MP4. Es el formato más extendido del mundo y por una buena razón: prácticamente cualquier teléfono, computadora o televisor puede reproducirlo sin instalar nada extra." },
      { h2: "Qué es realmente un MP4" },
      { p: "MP4 (MPEG-4 Part 14) es un \"contenedor\": un archivo que guarda dentro la pista de video, la de audio y, a veces, subtítulos. El video suele estar codificado en H.264 y el audio en AAC, una combinación que ofrece buena calidad con un tamaño de archivo razonable." },
      { h2: "Por qué es tan compatible" },
      { ul: [
        "Lo reproducen iPhone, Android, Windows, Mac y la mayoría de Smart TVs sin apps adicionales.",
        "Equilibra calidad y tamaño, ideal para guardar en el móvil sin llenar la memoria.",
        "Es el estándar que esperan las redes sociales si más adelante quieres volver a subir el video."
      ] },
      { h2: "¿Y si solo quiero el audio?" },
      { p: "Si lo que te interesa es la música o el sonido de un video, puedes descargar solo el audio (por ejemplo en M4A o MP3). Ocupa mucho menos espacio y es perfecto para escuchar en el coche o sin pantalla. En TuVideoDown puedes elegir esta opción antes de descargar." },
      { p: "En resumen: si dudas, descarga en MP4. Es la opción más segura para que el archivo te funcione en cualquier lugar." }
    ]
  },
  {
    slug: "descargar-tiktok-sin-marca-de-agua",
    title: "Cómo descargar videos de TikTok sin marca de agua",
    description:
      "Por qué TikTok añade la marca de agua, cómo guardar videos públicos en limpio y cuándo no es posible quitarla.",
    date: "2026-06-05",
    blocks: [
      { p: "La marca de agua de TikTok (el logo y el usuario que se mueven por la pantalla) es útil para dar crédito, pero molesta si quieres guardar un video para uso personal o reeditarlo. Aquí te explicamos cómo obtener una versión limpia cuando es posible." },
      { h2: "Por qué aparece la marca de agua" },
      { p: "TikTok incrusta la marca de agua al exportar el video desde la propia app para que, al compartirse en otras redes, se sepa de dónde viene. Esa versión \"marcada\" es la que normalmente se distribuye." },
      { h2: "Cómo guardarlo sin marca" },
      { ul: [
        "Copia el enlace del video desde el botón Compartir de TikTok.",
        "Pégalo en TuVideoDown.",
        "Si hay una fuente sin marca disponible, se descargará en limpio automáticamente."
      ] },
      { h2: "Cuándo no se puede" },
      { p: "No siempre existe una versión sin marca: depende de cómo se publicó el video y de las restricciones del autor. Cuando no hay fuente limpia, obtendrás la versión estándar. En cualquier caso, descarga solo contenido público y úsalo de forma personal, dando crédito al creador si lo compartes." }
    ]
  },
  {
    slug: "ver-videos-sin-conexion-offline-movil",
    title: "Cómo descargar videos para verlos sin conexión en el móvil",
    description:
      "Ideas prácticas para guardar videos y verlos offline en viajes, zonas sin cobertura o para ahorrar datos.",
    date: "2026-06-03",
    blocks: [
      { p: "Tener tus videos favoritos guardados en el teléfono es muy práctico: puedes verlos en un avión, en el metro, en zonas sin cobertura o simplemente para no gastar tus datos móviles. Descargarlos en MP4 te da total libertad para reproducirlos cuando quieras." },
      { h2: "Cómo guardarlos en el teléfono" },
      { ul: [
        "Copia el enlace del video público que quieras guardar.",
        "Pégalo en TuVideoDown y elige la calidad.",
        "El archivo se guarda en la carpeta de descargas de tu navegador, lista para reproducir."
      ] },
      { h2: "Consejos para ahorrar espacio y datos" },
      { p: "Si vas a ver el video en la pantalla pequeña del teléfono, 720p suele ser más que suficiente y ocupa bastante menos que 1080p o 4K. Reserva las resoluciones altas para cuando vayas a verlo en una pantalla grande." },
      { p: "Para descargar varios videos antes de un viaje, hazlo con WiFi para no consumir tus datos, y revisa de vez en cuando la carpeta de descargas para borrar lo que ya no necesites." },
      { h2: "Úsalo de forma responsable" },
      { p: "Descarga contenido público y consérvalo para tu uso personal. Respeta siempre los derechos de autor y los términos de cada plataforma; no redistribuyas ni publiques como tuyo el trabajo de otra persona." }
    ]
  },
  {
    slug: "descargar-videos-de-forma-segura-y-responsable",
    title: "Consejos para descargar videos de forma segura y responsable",
    description:
      "Buenas prácticas para descargar videos evitando riesgos y respetando los derechos de autor.",
    date: "2026-06-01",
    blocks: [
      { p: "Descargar videos es muy útil, pero conviene hacerlo bien: con seguridad para tu dispositivo y con respeto a quienes crean el contenido. Estas son nuestras recomendaciones." },
      { h2: "Seguridad para tu dispositivo" },
      { ul: [
        "Usa herramientas web como TuVideoDown que no requieren instalar programas ni extensiones: cuantas menos apps de origen dudoso instales, mejor.",
        "Desconfía de sitios que te piden descargar un \".exe\" o una extensión para \"poder bajar el video\": suele ser malware.",
        "Mantén tu navegador y tu sistema actualizados."
      ] },
      { h2: "Respeta los derechos de autor" },
      { p: "Descarga contenido para tu uso personal: verlo sin conexión, guardar un recuerdo o respaldar tu propio material. No descargues para revender, redistribuir ni publicar el trabajo de otra persona como si fuera tuyo." },
      { p: "Cada plataforma tiene sus propios términos de servicio. Antes de descargar, ten en cuenta lo que permite la red social de origen y, ante la duda, pide permiso al autor del video." },
      { h2: "Solo contenido público" },
      { p: "Las herramientas legítimas solo pueden acceder a videos públicos. El contenido privado, de pago o protegido tras un inicio de sesión no debe descargarse. Usar el sentido común y respetar a los creadores hace que internet sea mejor para todos." }
    ]
  }
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}
