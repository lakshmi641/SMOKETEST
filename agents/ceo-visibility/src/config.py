"""
CEO Visibility Agent Configuration
Loads settings from environment variables (GCP Secret Manager injected at runtime)
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Firebase Configuration
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "julley-platform-dev")
    firebase_credentials_file: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    # LiteLLM Configuration (LLM routing proxy)
    litellm_url: str = os.getenv(
        "LITELLM_URL",
        "https://litellm-proxy-46276910499.us-central1.run.app"
    )
    litellm_api_key: str = os.getenv("LITELLM_API_KEY", "")
    litellm_model: str = os.getenv("LITELLM_MODEL", "gemini-flash")
    
    # Cognee API Configuration (Knowledge service)
    cognee_api_url: str = os.getenv(
        "COGNEE_API_URL",
        "http://cognee-api.agentic.svc.cluster.local:8000"
    )
    cognee_api_key: Optional[str] = os.getenv("COGNEE_API_KEY")
    
    # Redis Configuration (Session memory + agent state)
    redis_host: str = os.getenv("REDIS_HOST", "redis-stack.agentic.svc.cluster.local")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_password: Optional[str] = os.getenv("REDIS_PASSWORD")
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    
    # Agno Agent Configuration
    agno_db_url: str = os.getenv(
        "AGNO_DB_URL",
        "postgresql://agno_user:agno_password@10.9.0.3:5432/agno_db"
    )
    agent_name: str = "CEO Visibility Agent"
    agent_timeout: int = int(os.getenv("AGENT_TIMEOUT", "300"))
    max_iterations: int = int(os.getenv("MAX_ITERATIONS", "10"))
    show_tool_calls: bool = os.getenv("SHOW_TOOL_CALLS", "true").lower() == "true"
    markdown: bool = os.getenv("MARKDOWN_RESPONSE", "true").lower() == "true"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8080
    log_level: str = os.getenv("LOG_LEVEL", "INFO")


def get_settings() -> Settings:
    """Get or create Settings instance (singleton pattern)"""
    if not hasattr(get_settings, "_instance"):
        get_settings._instance = Settings()
    return get_settings._instance
