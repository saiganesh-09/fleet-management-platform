from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ai_service_port: int = 8000
    # OpenAI-compatible LLM config. Empty ai_api_key => deterministic offline mode.
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_base_url: str = "https://api.openai.com/v1"
    # Shared secret between backend and this service
    ai_internal_token: str = "dev-internal-token"
    backend_url: str = "http://localhost:4000"

    class Config:
        env_file = ".env"


settings = Settings()
