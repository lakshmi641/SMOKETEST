"""
Resource Utilization Tool
Tracks team capacity and resource allocation
"""

import logging
from typing import Any
from models.schemas import ResourceUtilization
from tools.firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_resource_utilization(agent: Any = None) -> ResourceUtilization:
    """
    Calculate resource utilization across the organization
    """
    try:
        # Extract company_id from the agent context provided by Agno
        company_id = agent.context.get("company_id") if agent and agent.context else None

        if not company_id:
            raise ValueError("Critical Error: company_id missing from agent context.")

        client = FirestoreClient(company_id)
        
        # Fetch data
        users = await client.get_users()
        assignments = await client.get_position_assignments()
        tasks = await client.get_tasks_by_status()
        
        total_resources = len(users)
        allocated_resources = len([a for a in assignments if a.get("status") == "active"])
        idle_resources = total_resources - allocated_resources
        
        utilization_rate = (allocated_resources / total_resources * 100) if total_resources > 0 else 0
        
        # Check for over-allocation (user assigned to multiple high-priority tasks)
        user_task_count = {}
        for task in tasks:
            assignee = task.get("assignee")
            if assignee:
                user_task_count[assignee] = user_task_count.get(assignee, 0) + 1
        
        over_allocated = len([u for u, count in user_task_count.items() if count > 5])
        
        # Resource breakdown by role
        role_breakdown = {}
        for user in users:
            role = user.get("role", "unknown")
            role_breakdown[role] = role_breakdown.get(role, 0) + 1
        
        summary = f"Resource utilization: {utilization_rate:.1f}%. "
        summary += f"{allocated_resources} of {total_resources} team members actively assigned. "
        if idle_resources > 0:
            summary += f"{idle_resources} idle resources. "
        if over_allocated > 0:
            summary += f"{over_allocated} team members over-allocated."
        
        return ResourceUtilization(
            total_resources=total_resources,
            allocated_resources=allocated_resources,
            utilization_rate=utilization_rate,
            idle_resources=idle_resources,
            over_allocated=over_allocated,
            resource_breakdown=role_breakdown,
            summary=summary,
        )
        
    except Exception as e:
        logger.error(f"Error calculating resource utilization: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_resource_utilization",
        "description": "Calculates resource utilization: team capacity, allocation rate, idle resources, and over-allocation.",
        "fn": get_resource_utilization,
    }
