"""
Agno Agent Definition
Wires all tools and creates the CEO Visibility Agent
"""

import logging
from agno.agent import Agent
from agno.models.openai import OpenAILike
from agno.db.postgres import PostgresDb

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
    """Configure the CEO Visibility Agent with tenant-scoped tools"""

    return Agent(
        name="CEO Visibility Agent",

        model=OpenAILike(
            id=settings.litellm_model,
            base_url=settings.litellm_url,
            api_key=settings.litellm_api_key,
        ),

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
            "You are the CEO Visibility Agent for Julley Platform.",
            f"You operate in the context of company: {company_id}.",
            "Always fetch real-time data using tools before answering.",
            "Provide insights with clear metrics and actionable summaries.",
        ],

        context={
            "company_id": company_id,
            "user_id": user_id,
        },

        db=PostgresDb(
            db_url=settings.agno_db_url,
            table_name="ceo_agent_sessions",
        ),
        enable_user_memories=True,

        show_tool_calls=True,
        markdown=True,
    )


async def init_agent_system():
    """Initialize required systems on startup"""
    init_firebase()
    logger.info("CEO Agent System Initialized")