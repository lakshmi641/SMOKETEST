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
    cognee_db_host: str = os.getenv("COGNEE_DB_HOST", "10.9.0.3")
    cognee_db_port: int = int(os.getenv("COGNEE_DB_PORT", "5432"))
    cognee_db_name: str = os.getenv("COGNEE_DB_NAME", "cognee_db")
    cognee_db_user: str = os.getenv("COGNEE_DB_USER", "cognee_user")
    cognee_db_password: str = os.getenv("COGNEE_DB_PASSWORD", "")
    
    # Redis (vector cache + session store)
    redis_host: str = os.getenv("REDIS_HOST", "redis-stack.agentic.svc.cluster.local")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_password: Optional[str] = os.getenv("REDIS_PASSWORD")
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    
    # LiteLLM (embeddings + LLM routing)
    litellm_url: str = os.getenv("LITELLM_URL", "https://litellm-proxy-46276910499.us-central1.run.app")
    litellm_api_key: str = os.getenv("LITELLM_API_KEY", "")
    
    # Cognee settings
    cognee_max_chunk_size: int = int(os.getenv("COGNEE_MAX_CHUNK_SIZE", "2000"))
    cognee_batch_size: int = int(os.getenv("COGNEE_BATCH_SIZE", "50"))
    cognee_timeout: int = int(os.getenv("COGNEE_TIMEOUT", "300"))
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


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
    if settings.redis_password:
        return (
            f"redis://:{settings.redis_password}@"
            f"{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
        )
    return f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"


def configure_cognee():
    """
    Initialize Cognee SDK with production settings
    
    Returns:
        Cognee configured instance
    """
    try:
        import cognee
        from cognee.models.data_models import DataModels
        
        # Configure vector store (pgvector)
        cognee.config.set_vector_store(
            "pgvector",
            {
                "connection_string": get_cognee_connection_string(),
            }
        )
        
        # Configure embeddings (Ollama via LiteLLM)
        settings = CogneeSettings()
        cognee.config.set_embedding_provider(
            "ollama",
            {
                "base_url": settings.litellm_url,
                "api_key": settings.litellm_api_key,
                "model": "local-embeddings",  # Maps to Ollama nomic-embed-text via LiteLLM
                "dimension": 768,
            }
        )
        
        # Configure LLM (Gemini Flash via LiteLLM for entity extraction)
        cognee.config.set_llm_provider(
            "litellm",
            {
                "base_url": settings.litellm_url,
                "api_key": settings.litellm_api_key,
                "model": "gemini-flash",
            }
        )
        
        # Configure Redis cache (hot vector cache)
        cognee.config.set_cache_provider(
            "redis",
            {
                "connection_string": get_redis_connection_string(),
                "ttl": 3600,  # 1 hour TTL for cached embeddings
            }
        )
        
        # PostgreSQL-only mode (skip Neo4j graph store)
        cognee.config.skip_graph_store()
        
        return cognee
        
    except Exception as e:
        raise Exception(f"Failed to configure Cognee: {str(e)}")
