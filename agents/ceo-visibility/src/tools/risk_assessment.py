"""
Risk Assessment Tool
Evaluates organizational risks
"""

import logging
from typing import Any
from models.schemas import RiskAssessment
from tools.firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_risk_assessment(agent: Any = None) -> RiskAssessment:
    """
    Assess organizational risks based on project and task data
    """
    try:
        # Extract company_id from the agent context provided by Agno
        company_id = agent.context.get("company_id") if agent and agent.context else None

        if not company_id:
            raise ValueError("Critical Error: company_id missing from agent context.")

        client = FirestoreClient(company_id)
        
        # Fetch relevant data
        projects = await client.get_projects()
        tasks = await client.get_tasks_by_status()
        
        # Identify risks
        high_risk_projects = [p for p in projects if p.get("riskLevel") == "high"]
        critical_risk_projects = [p for p in projects if p.get("riskLevel") == "critical"]
        overdue_tasks = [t for t in tasks if t.get("isOverdue", False)]
        stalled_tasks = [t for t in tasks if t.get("status") == "stalled"]
        
        # Calculate risk score
        risk_points = 0
        risk_points += len(critical_risk_projects) * 25
        risk_points += len(high_risk_projects) * 10
        risk_points += len(overdue_tasks) * 5
        risk_points += len(stalled_tasks) * 5
        
        risk_score = min(100, risk_points)
        
        # Categorize
        if risk_score >= 70:
            risk_category = "high"
        elif risk_score >= 40:
            risk_category = "medium"
        else:
            risk_category = "low"
        
        # Top risks
        top_risks = []
        if critical_risk_projects:
            top_risks.append({
                "type": "Critical Projects",
                "count": len(critical_risk_projects),
                "impact": "Critical",
            })
        if len(overdue_tasks) > 0:
            top_risks.append({
                "type": "Overdue Tasks",
                "count": len(overdue_tasks),
                "impact": "High",
            })
        if len(stalled_tasks) > 0:
            top_risks.append({
                "type": "Stalled Work",
                "count": len(stalled_tasks),
                "impact": "Medium",
            })
        
        # Mitigation status
        mitigation_status = {
            "at_risk": len(high_risk_projects) + len(critical_risk_projects),
            "mitigated": sum(1 for p in projects if p.get("riskMitigationPlan")),
        }
        
        summary = f"Risk assessment score: {risk_score:.0f}/100 ({risk_category}). "
        if top_risks:
            parts = [f"{r['count']} {r['type']}".lower() for r in top_risks[:2]]
            summary += f"Key concerns: {', '.join(parts)}. "
        else:
            summary += "No critical risks identified. "
        
        return RiskAssessment(
            risk_score=risk_score,
            risk_category=risk_category,
            top_risks=top_risks,
            mitigation_status=mitigation_status,
            summary=summary,
        )
        
    except Exception as e:
        logger.error(f"Error assessing risks: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_risk_assessment",
        "description": "Evaluates organizational risks including at-risk projects, overdue tasks, and stalled work.",
        "fn": get_risk_assessment,
    }
