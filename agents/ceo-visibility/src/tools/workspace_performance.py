"""
Workspace Performance Tool
Tracks health and metrics by workspace
"""

import logging
from typing import Any, List
from datetime import datetime
from ..models.schemas import WorkspacePerformance
from .firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_workspace_performance(agent: Any = None) -> dict:
    """
    Get performance metrics for all workspaces
    """
    try:
        # Extract company_id from the agent context provided by Agno
        company_id = agent.context.get("company_id") if agent and agent.context else None

        if not company_id:
            raise ValueError("Critical Error: company_id missing from agent context.")

        client = FirestoreClient(company_id)
        
        # Fetch data
        workspaces = await client.get_workspaces()
        tasks = await client.get_tasks_by_status()
        users = await client.get_users()
        
        workspace_perf = []
        
        for workspace in workspaces:
            workspace_id = workspace.get("id")
            workspace_name = workspace.get("name", "Unknown")
            
            # Get tasks for this workspace
            ws_tasks = [t for t in tasks if t.get("workspaceId") == workspace_id]
            
            # Calculate metrics
            task_count = len(ws_tasks)
            completed = len([t for t in ws_tasks if t.get("status") == "completed"])
            completion_rate = (completed / task_count * 100) if task_count > 0 else 0
            
            # Get team size (users in this workspace)
            team_members = [u for u in users if u.get("workspaceId") == workspace_id]
            team_size = len(team_members)
            
            # Health score (based on completion rate and velocity)
            last_activity = workspace.get("lastUpdated")
            
            health_score = completion_rate * 0.7  # Weighted by completion
            if team_size > 0 and task_count > team_size * 3:
                health_score *= 0.8  # Reduce if overloaded
            
            perf = WorkspacePerformance(
                workspace_name=workspace_name,
                task_count=task_count,
                completion_rate=completion_rate,
                team_size=team_size,
                last_activity=last_activity,
                health_score=health_score,
            )
            workspace_perf.append(perf)
        
        # Calculate summary
        avg_health = sum(w.health_score for w in workspace_perf) / len(workspace_perf) if workspace_perf else 0
        
        return {
            "workspaces": [w.dict() for w in workspace_perf],
            "total_workspaces": len(workspaces),
            "average_health": avg_health,
            "summary": f"{len(workspaces)} workspaces with average health score of {avg_health:.1f}.",
        }
        
    except Exception as e:
        logger.error(f"Error getting workspace performance: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_workspace_performance",
        "description": "Returns performance metrics for all workspaces including task counts, completion rates, and team utilization.",
        "fn": get_workspace_performance,
    }
