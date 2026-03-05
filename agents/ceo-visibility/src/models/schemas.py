"""
Pydantic Models & Schemas
Data contracts for agent responses and tool results
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ============================================================================
# Health & Strategic Metrics
# ============================================================================

class HealthIndicator(BaseModel):
    """Single health metric"""
    metric: str
    value: float
    status: str  # "healthy", "warning", "critical"
    trend: Optional[str] = None  # "up", "down", "stable"


class StrategicHealth(BaseModel):
    """Organizational strategic health assessment"""
    overall_score: float = Field(0.0, ge=0, le=100)
    status: str
    indicators: List[HealthIndicator]
    summary: str
    last_updated: datetime


class PortfolioStatus(BaseModel):
    """Portfolio overview"""
    total_projects: int
    active_projects: int
    completed_projects: int
    at_risk_projects: int
    portfolio_health: float
    summary: str


class DeliveryVelocity(BaseModel):
    """Task delivery metrics"""
    tasks_completed_week: int
    tasks_completed_month: int
    average_completion_time_days: float
    velocity_trend: str  # "improving", "stable", "declining"
    estimated_capacity: int
    current_workload: int
    summary: str


class RiskAssessment(BaseModel):
    """Risk evaluation"""
    risk_score: float
    risk_category: str  # "low", "medium", "high"
    top_risks: List[Dict[str, Any]]
    mitigation_status: Dict[str, int]  # status -> count
    summary: str


class ResourceUtilization(BaseModel):
    """Resource metrics"""
    total_resources: int
    allocated_resources: int
    utilization_rate: float
    idle_resources: int
    over_allocated: int
    resource_breakdown: Dict[str, int]
    summary: str


class ApprovalQueueStatus(BaseModel):
    """Pending approvals"""
    total_pending: int
    pending_by_type: Dict[str, int]
    oldest_pending_days: int
    urgent_count: int
    summary: str


class WorkspacePerformance(BaseModel):
    """Workspace health snapshot"""
    workspace_name: str
    task_count: int
    completion_rate: float
    team_size: int
    last_activity: Optional[datetime]
    health_score: float


# ============================================================================
# Knowledge & Search
# ============================================================================

class KnowledgeSearchResult(BaseModel):
    """Single search result"""
    text: str
    document_name: str
    score: float
    metadata: Optional[Dict[str, Any]] = None


class KnowledgeSearchResponse(BaseModel):
    """Knowledge search results"""
    query: str
    results: List[KnowledgeSearchResult]
    total: int


# ============================================================================
# Tool Execution Results
# ============================================================================

class ToolResult(BaseModel):
    """Generic tool result wrapper"""
    tool_name: str
    success: bool
    data: Any
    error_message: Optional[str] = None
    execution_time_ms: float


class AgentResponse(BaseModel):
    """Full agent response"""
    message: str
    tool_calls: List[ToolResult]
    suggestions: Optional[List[str]] = None
