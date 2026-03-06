"""
Cognee SDK Configuration
Configures vector store, embeddings, LLM, and cache backends
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class CogneeSettings(BaseSettings):
    """Cognee configuration from environment variables"""
    
    # Database (pgvector)
    cognee_db_host: str = os.getenv("COGNEE_DB_HOST", "postgres")
    cognee_db_port: int = int(os.getenv("COGNEE_DB_PORT", "5432"))
    cognee_db_name: str = os.getenv("COGNEE_DB_NAME", "agent_db")
    cognee_db_user: str = os.getenv("COGNEE_DB_USER", "cognee_user")
    cognee_db_password: str = os.getenv("COGNEE_DB_PASSWORD", "cognee_password_dev")
    
    # Redis (vector cache + session store)
    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_password: Optional[str] = os.getenv("REDIS_PASSWORD", "redis_password_dev")
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    
    # LiteLLM (embeddings + LLM routing)
    litellm_url: str = os.getenv("LITELLM_URL", "http://litellm:8000")
    litellm_api_key: str = os.getenv("LITELLM_API_KEY", "sk-litellm-dev-key")
    
    # Cognee settings
    cognee_max_chunk_size: int = int(os.getenv("COGNEE_MAX_CHUNK_SIZE", "2000"))
    cognee_batch_size: int = int(os.getenv("COGNEE_BATCH_SIZE", "50"))
    cognee_timeout: int = int(os.getenv("COGNEE_TIMEOUT", "300"))

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"  # Prevents crash if extra environment variables exist
    }


def get_cognee_connection_string() -> str:
    """Generate PostgreSQL connection string for Cognee"""
    settings = CogneeSettings()
    return (
        f"postgresql://{settings.cognee_db_user}:{settings.cognee_db_password}@"
        f"{settings.cognee_db_host}:{settings.cognee_db_port}/{settings.cognee_db_name}"
    )


def get_redis_connection_string() -> str:
    """Generate Redis connection string"""
    settings = CogneeSettings()
    auth = f":{settings.redis_password}@" if settings.redis_password else ""
    return f"redis://{auth}{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"


def configure_cognee():
    """
    Initialize Cognee SDK with production settings (Cognee v0.3.2 compatible)
    """
    try:
        import cognee
        settings = CogneeSettings()
        
        # --- VECTOR STORE CONFIGURATION ---
        # Cognee 0.3.2 uses direct attribute assignment
        cognee.config.db_type = "pgvector"
        cognee.config.db_url = get_cognee_connection_string()
        
        # --- EMBEDDING PROVIDER CONFIGURATION ---
        # LiteLLM acts as an OpenAI-compatible proxy
        cognee.config.embedding_provider = "openai"
        cognee.config.embedding_endpoint = f"{settings.litellm_url}/v1"
        cognee.config.embedding_api_key = settings.litellm_api_key
        cognee.config.embedding_model = "nomic-embed-text"
        
        # --- LLM PROVIDER CONFIGURATION ---
        cognee.config.llm_provider = "openai"
        cognee.config.llm_endpoint = f"{settings.litellm_url}/v1"
        cognee.config.llm_api_key = settings.litellm_api_key
        cognee.config.llm_model = "gemini-1.5-flash"
        
        # --- CACHE PROVIDER CONFIGURATION ---
        cognee.config.cache_type = "redis"
        cognee.config.redis_url = get_redis_connection_string()
        
        # Disable graph store to focus on Vector RAG for the smoke test
        cognee.config.skip_graph_store = True
        
        return cognee
        
    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}") # Visible in 'docker logs'
        raise Exception(f"Failed to configure Cognee: {str(e)}")