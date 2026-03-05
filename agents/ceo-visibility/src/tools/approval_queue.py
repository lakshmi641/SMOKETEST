"""
Approval Queue Tool
Tracks pending approvals and blockers
"""

import logging
from ..models.schemas import ApprovalQueueStatus
from .firestore_client import FirestoreClient

logger = logging.getLogger(__name__)


async def get_approval_queue(company_id: str) -> ApprovalQueueStatus:
    """
    Get current approval queue status
    
    Args:
        company_id: Tenant identifier
        
    Returns:
        ApprovalQueueStatus with pending counts and age
    """
    try:
        client = FirestoreClient(company_id)
        approvals = await client.get_approval_instances(status="pending")
        
        total_pending = len(approvals)
        
        # Group by type
        pending_by_type = {}
        oldest_days = 0
        urgent_count = 0
        
        for approval in approvals:
            approval_type = approval.get("type", "unknown")
            pending_by_type[approval_type] = pending_by_type.get(approval_type, 0) + 1
            
            if approval.get("urgency") == "urgent":
                urgent_count += 1
            
            # Calculate age
            created_at = approval.get("createdAt")
            if created_at:
                from datetime import datetime
                if hasattr(created_at, 'timestamp'):
                    age = (datetime.utcnow() - created_at).days
                    oldest_days = max(oldest_days, age)
        
        summary = f"{total_pending} pending approvals. "
        if urgent_count > 0:
            summary += f"{urgent_count} marked urgent. "
        if oldest_days > 0:
            summary += f"Oldest pending: {oldest_days} days."
        
        return ApprovalQueueStatus(
            total_pending=total_pending,
            pending_by_type=pending_by_type,
            oldest_pending_days=oldest_days,
            urgent_count=urgent_count,
            summary=summary,
        )
        
    except Exception as e:
        logger.error(f"Error getting approval queue: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "get_approval_queue",
        "description": "Returns the status of pending approvals: total count, breakdown by type, oldest pending, and urgent items.",
        "fn": get_approval_queue,
        "args": {
            "company_id": {
                "type": "string",
                "description": "Company/tenant ID",
                "required": True,
            }
        }
    }
