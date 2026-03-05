"""
Agno Agent Definition
Wires all tools and creates the CEO Visibility Agent
"""

import logging
from typing import List, Optional
from agno.agent import Agent
from agno.models.openai import OpenAILike

# Corrected Imports for Agno 2.5.6
try:
    from agno.storage.postgres import PostgresStorage
except ImportError:
    # If the above fails, Agno might be looking in the memory module
    try:
        from agno.memory.db.postgres import PostgresStorage
    except ImportError:
        raise ImportError("Could not find PostgresStorage. Please run: pip install 'agno[postgres]'")

try:
    from agno.memory.v2.db.redis import RedisMemoryDb
except ImportError:
    from agno.memory.db.redis import RedisMemoryDb

from config import get_settings
from auth import init_firebase

# Import tool creation functions
from tools.strategic_health import create_tool as create_strategic_health_tool
from tools.portfolio_status import create_tool as create_portfolio_status_tool
from tools.delivery_velocity import create_tool as create_delivery_velocity_tool
from tools.risk_assessment import create_tool as create_risk_assessment_tool
from tools.resource_utilization import create_tool as create_resource_utilization_tool
from tools.approval_queue import create_tool as create_approval_queue_tool
from tools.workspace_performance import create_tool as create_workspace_performance_tool
from tools.knowledge_search import create_tool as create_knowledge_search_tool
from tools.knowledge_add import create_tool as create_knowledge_add_tool

logger = logging.getLogger(__name__)
settings = get_settings()

def create_ceo_agent(company_id: str, user_id: str) -> Agent:
    """Configures the CEO Visibility Agent with tenant-scoped tools."""

    # Tool wrappers are no longer needed. The agent will inject `company_id`
    # into tools that require it when we pass it to `agent.arun()`.

    # Setup Redis Memory
    redis_url = f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
    if settings.redis_password:
        redis_url = f"redis://:{settings.redis_password}@{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
    
    memory_obj = None
    if RedisMemoryDb:
        memory_obj = RedisMemoryDb(
            redis_url=redis_url,
            prefix=f"session:{company_id}:ceo-agent:{user_id}",
        )

    # Create the Agent
    return Agent(
        name="CEO Visibility Agent",
        model=OpenAILike(
            id=settings.litellm_model,
            base_url=settings.litellm_url,
            api_key=settings.litellm_api_key,
        ),
        # Use structured tool definitions for better LLM performance
        tools=[
            create_strategic_health_tool(),
            create_portfolio_status_tool(),
            create_delivery_velocity_tool(),
            create_risk_assessment_tool(),
            create_resource_utilization_tool(),
            create_approval_queue_tool(),
            create_workspace_performance_tool(),
            create_knowledge_search_tool(),
            create_knowledge_add_tool(),
        ],
        instructions=[
            f"You are the CEO Visibility Agent for Julley Platform.",
            f"Operating in context of company: {company_id}",
            "Always fetch real-time data using tools before providing insights.",
            "Format responses with bold metrics and actionable summaries.",
        ],
        memory=memory_obj,
        storage=PostgresStorage(
            db_url=settings.agno_db_url,
            table_name="ceo_agent_sessions",
        ),
        show_tool_calls=True,
        markdown=True,
    )

async def init_agent_system():
    init_firebase()
    logger.info("CEO Agent System Initialized")