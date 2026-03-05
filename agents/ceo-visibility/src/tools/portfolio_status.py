"""
Portfolio Status Tool
Provides overview of all projects in the portfolio
"""

import logging
from typing import Any
from datetime import datetime

from ..models.schemas import PortfolioStatus
from .firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_portfolio_status(company_id: str) -> PortfolioStatus:
    """
    Get portfolio overview: project count, health, distribution
    
    Args:
        company_id: Tenant identifier
        
    Returns:
        PortfolioStatus with project metrics
    """
    try:
        client = FirestoreClient(company_id)
        projects = await client.get_projects()
        
        total = len(projects)
        active = len([p for p in projects if p.get("status") in ["in-progress", "planning"]])
        completed = len([p for p in projects if p.get("status") == "completed"])
        at_risk = len([p for p in projects if p.get("riskLevel") in ["high", "critical"]])
        
        # Calculate portfolio health (% healthy projects)
        healthy = total - at_risk
        portfolio_health = (healthy / total * 100) if total > 0 else 0
        
        summary = f"Portfolio contains {total} projects: {active} active, {completed} completed. "
        if at_risk > 0:
            summary += f"{at_risk} projects flagged at-risk. "
        summary += f"Overall portfolio health: {portfolio_health:.1f}%."
        
        return PortfolioStatus(
            total_projects=total,
            active_projects=active,
            completed_projects=completed,
            at_risk_projects=at_risk,
            portfolio_health=portfolio_health,
            summary=summary,
        )
        
    except Exception as e:
        logger.error(f"Error getting portfolio status: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_portfolio_status",
        "description": "Returns overview of the project portfolio: total projects, active, completed, and at-risk counts with overall health score.",
        "fn": get_portfolio_status,
        "args": {
            "company_id": {
                "type": "string",
                "description": "Company/tenant ID",
                "required": True,
            }
        }
    }
