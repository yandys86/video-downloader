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

    # Watermark opcional en la esquina de cada Short. Vacío = sin watermark.
    # Ej: "tuvideodown.com" — se dibuja con drawtext de ffmpeg.
    watermark_text: str = ""

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()  # type: ignore[call-arg]
