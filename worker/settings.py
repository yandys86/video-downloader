from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    worker_secret: str

    anthropic_api_key: str
    anthropic_model: str = "claude-haiku-4-5-20251001"

    workspace_dir: str = "/var/lib/shorts-worker"
    db_path: str = "/var/lib/shorts-worker/jobs.db"

    max_input_duration_seconds: int = 1200
    max_highlights_per_job: int = 5
    max_concurrent_jobs: int = 2

    whisper_model: str = "small"
    whisper_compute_type: str = "int8"
    whisper_language: str = "es"

    default_tts_voice: str = "es-ES-AlvaroNeural"
    default_tts_rate: str = "+8%"

    pexels_api_key: str = ""

    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()  # type: ignore[call-arg]
