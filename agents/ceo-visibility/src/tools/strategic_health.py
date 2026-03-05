"""
Strategic Health Tool
Calculates organizational health based on task completion, project status, and team assignment
"""

import logging
from typing import Any
from datetime import datetime, timedelta

from ..models.schemas import StrategicHealth, HealthIndicator
from .firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_strategic_health(agent: Any = None) -> StrategicHealth:
    """
    Calculate strategic health of the organization
    """
    try:
        # Extract company_id from agent context
        company_id = None
        if agent and hasattr(agent, "context"):
            company_id = agent.context.get("company_id")
            
        if not company_id:
            raise ValueError("company_id not found in agent context")

        client = FirestoreClient(company_id)
        
        # Fetch all needed data in parallel
        data = await client.fetch_dashboard_data()
        
        # Calculate individual metrics
        indicators = []
        scores = []
        
        # 1. Task Completion Rate (target: 90%+)
        tasks = data["tasks"]
        if tasks:
            completed = len([t for t in tasks if t.get("status") == "completed"])
            completion_rate = (completed / len(tasks)) * 100 if tasks else 0
            status = "healthy" if completion_rate >= 85 else "warning" if completion_rate >= 70 else "critical"
            indicators.append(HealthIndicator(
                metric="Task Completion Rate",
                value=completion_rate,
                status=status,
                trend="up" if completion_rate > 75 else "stable"
            ))
            scores.append(min(completion_rate, 100))
        
        # 2. Project Health (% not at-risk)
        projects = data["projects"]
        if projects:
            at_risk = len([p for p in projects if p.get("riskLevel", "low") != "low"])
            project_health = ((len(projects) - at_risk) / len(projects)) * 100
            status = "healthy" if project_health >= 80 else "warning" if project_health >= 60 else "critical"
            indicators.append(HealthIndicator(
                metric="Project Health",
                value=project_health,
                status=status,
            ))
            scores.append(project_health)
        
        # 3. Team Capacity (target: 70-95% utilization)
        users = data["users"]
        assignments = data["position_assignments"]
        if users and assignments:
            assigned = len([a for a in assignments if a.get("status") == "active"])
            capacity = (assigned / len(users)) * 100 if users else 0
            status = "healthy" if 70 <= capacity <= 95 else "warning" if 50 <= capacity else "critical"
            indicators.append(HealthIndicator(
                metric="Team Capacity",
                value=capacity,
                status=status,
            ))
            scores.append(capacity)
        
        # 4. Approval Queue Health (target: < 10 pending)
        approvals = data["approval_instances"]
        pending = len([a for a in approvals if a.get("status") == "pending"])
        approval_health = max(0, 100 - (pending * 5))  # 5 points per pending
        status = "healthy" if pending < 10 else "warning" if pending < 25 else "critical"
        indicators.append(HealthIndicator(
            metric="Approval Queue",
            value=approval_health,
            status=status,
        ))
        scores.append(approval_health)
        
        # Calculate overall score
        overall_score = sum(scores) / len(scores) if scores else 0
        
        # Determine overall status
        if overall_score >= 80:
            overall_status = "Healthy"
        elif overall_score >= 60:
            overall_status = "At Risk"
        else:
            overall_status = "Critical"
        
        # Generate summary
        summary = f"Strategic health is {overall_status.lower()}. "
        critical_indicators = [i for i in indicators if i.status == "critical"]
        if critical_indicators:
            summary += f"Critical attention needed: {', '.join([i.metric for i in critical_indicators])}. "
        else:
            summary += "All systems operating nominally. "
        
        summary += f"Overall organizational score: {overall_score:.1f}/100."
        
        return StrategicHealth(
            overall_score=overall_score,
            status=overall_status,
            indicators=indicators,
            summary=summary,
            last_updated=datetime.utcnow(),
        )
        
    except Exception as e:
        logger.error(f"Error calculating strategic health: {str(e)}")
        raise


# Register as Agno tool
def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_strategic_health",
        "description": "Calculates strategic health of the organization based on task completion, project status, team capacity, and pending approvals.",
        "fn": get_strategic_health,
    }