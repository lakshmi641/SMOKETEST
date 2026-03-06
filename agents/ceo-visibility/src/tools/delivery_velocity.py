"""
Delivery Velocity Tool
Tracks task completion rates and team velocity
"""

import logging
from typing import Any
from datetime import datetime, timedelta

from models.schemas import DeliveryVelocity
from tools.firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_delivery_velocity(agent: Any = None) -> DeliveryVelocity:
    """
    Calculate delivery velocity: tasks completed over time
    """
    try:
        # Extract company_id from the agent context provided by Agno
        company_id = agent.context.get("company_id") if agent and agent.context else None

        if not company_id:
            raise ValueError("Critical Error: company_id missing from agent context.")

        client = FirestoreClient(company_id)
        
        # Fetch completed tasks for the last 7 and 30 days
        completed_week = await client.get_completed_tasks(days=7)
        completed_month = await client.get_completed_tasks(days=30)
        all_tasks = await client.get_tasks_by_status()
        
        # Calculate velocity metrics
        tasks_week = len(completed_week)
        tasks_month = len(completed_month)
        
        # Average completion time (in days)
        avg_completion_time = 0
        if completed_week:
            total_time = 0
            count = 0
            for task in completed_week:
                created_at = task.get("createdAt")
                completed_at = task.get("completedAt")
                if created_at and completed_at:
                    if isinstance(created_at, datetime) and isinstance(completed_at, datetime):
                        total_time += (completed_at - created_at).days
                        count += 1
            avg_completion_time = total_time / count if count > 0 else 0
        
        # Determine trend
        avg_week = tasks_week / 7 if tasks_week > 0 else 0
        avg_prev_month = (tasks_month - tasks_week) / 23 if (tasks_month - tasks_week) > 0 else 0
        if avg_week > avg_prev_month * 1.1:
            velocity_trend = "improving"
        elif avg_week < avg_prev_month * 0.9:
            velocity_trend = "declining"
        else:
            velocity_trend = "stable"
        
        # Calculate capacity
        open_tasks = len([t for t in all_tasks if t.get("status") in ["open", "in-progress"]])
        estimated_capacity = max(1, int(avg_week * 2)) if avg_week > 0 else 1
        
        summary = f"Team completed {tasks_week} tasks this week ({avg_week:.1f}/day). "
        summary += f"Velocity is {velocity_trend}. "
        summary += f"Current workload: {open_tasks} open tasks. "
        summary += f"Average task completion time: {avg_completion_time:.1f} days."
        
        return DeliveryVelocity(
            tasks_completed_week=tasks_week,
            tasks_completed_month=tasks_month,
            average_completion_time_days=avg_completion_time,
            velocity_trend=velocity_trend,
            estimated_capacity=estimated_capacity,
            current_workload=open_tasks,
            summary=summary,
        )
        
    except Exception as e:
        logger.error(f"Error calculating delivery velocity: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_delivery_velocity",
        "description": "Calculates team delivery velocity: tasks completed per week/month, average completion time, velocity trend, and workload capacity.",
        "fn": get_delivery_velocity,
    }
