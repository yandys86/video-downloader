from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    worker_secret: str

    anthropic_api_key: str
    anthropic_model: str = "claude-haiku-4-5-20251001"

    workspace_dir: str = "/var/lib/shorts-worker"
    db_path: str = "/var/lib/shorts-worker/jobs.db"

    # Duración máxima del vídeo de entrada. 3600s = 60 min cubre la mayoría
    # de podcasts, charlas y entrevistas. Whisper base en CPU procesa 60min
    # en ~5-10 min. Subir a 7200 (2h) si quieres procesar contenido largo.
    max_input_duration_seconds: int = 3600
    max_highlights_per_job: int = 5
    max_concurrent_jobs: int = 2
    # Máximo de Shorts (generate + quick_clip) por IP y día. 0 = desactivar
    # el rate limit (útil para desarrollo/testing). En producción con tráfico
    # público, subir a 3-5 para evitar abuso.
    max_shorts_per_ip_per_day: int = 1000

    # `base` (74M params) es 2-3x más rápido que `small` (244M) en CPU.
    # Para detectar highlights la calidad de base es suficiente porque
    # Claude interpreta el sentido, no las palabras exactas. Subir a
    # `small` o `medium` para transcripciones más fieles a costa de tiempo.
    whisper_model: str = "base"
    whisper_compute_type: str = "int8"
    # Vacío = autodetectar idioma. Forzar solo si sabes que todos los vídeos
    # vienen en un idioma concreto (ej. "es", "en"). Forzar el idioma
    # equivocado + vad_filter descarta segmentos y devuelve transcript vacío.
    whisper_language: str = ""

    default_tts_voice: str = "es-ES-AlvaroNeural"
    default_tts_rate: str = "+8%"

    pexels_api_key: str = ""

    # Groq API para transcripción cloud (whisper-large-v3-turbo).
    # Gratis (free tier ~4000min/día), 20x más rápido que Whisper local
    # y mucha mejor calidad que YouTube auto-captions. Obtén una key en
    # https://console.groq.com/keys — deja vacío para saltar Groq.
    groq_api_key: str = ""
    groq_model: str = "whisper-large-v3-turbo"

    # --- YouTube (subida de Shorts al canal del usuario) ---
    # Vacíos = se usan <workspace>/youtube/client_secrets.json y token.json.
    youtube_client_secrets: str = ""
    youtube_token_file: str = ""
    # Zona del usuario para calcular los huecos de publicación (08:00 / 20:00).
    tz_publicacion: str = "America/Chicago"
    # Cuántos Shorts por vídeo y cada cuánto se publican.
    autoshorts_por_video: int = 2
    autoshorts_cada_horas: int = 12

    # Watermark opcional en la esquina de cada Short. Vacío = sin watermark.
    # Ej: "tuvideodown.com" — se dibuja con drawtext de ffmpeg.
    watermark_text: str = ""

    # Web Push (VAPID) para notificaciones cuando un job completa.
    # Vacío = notificaciones desactivadas (el frontend seguirá funcionando).
    # Genera con: python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_pem().decode())"
    vapid_private_key: str = ""
    vapid_public_key_b64url: str = ""
    vapid_subject: str = "mailto:admin@example.com"

    # Email delivery vía Resend (opcional). Free tier: 100/día, 3000/mes.
    # Get key: https://resend.com — el dominio de EMAIL_FROM debe estar verificado
    # en Resend (o usar el sandbox onboarding@resend.dev para pruebas).
    resend_api_key: str = ""
    email_from: str = ""
    # Adjuntar MP4 al email si pesa menos de este límite (bytes). Resend deja
    # ~10 MB en total. Si excede, se envía solo el enlace de descarga.
    email_max_attachment_bytes: int = 9 * 1024 * 1024
    email_public_base_url: str = "https://tuvideodown.com"

    # Telegram Bot (opcional) — envía el MP4 al usuario cuando termina el Reel.
    # Vacío = feature desactivada. Crear un bot con @BotFather en Telegram.
    telegram_bot_token: str = ""
    # Límite duro de Telegram Bot API para sendVideo (~50 MiB). Si el archivo
    # es mayor, mandamos un aviso con enlace al MP4 en lugar del vídeo.
    telegram_max_video_bytes: int = 45 * 1024 * 1024
    # Base URL pública para construir enlaces de descarga en el mensaje fallback.
    telegram_public_base_url: str = "https://tuvideodown.com"

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()  # type: ignore[call-arg]
