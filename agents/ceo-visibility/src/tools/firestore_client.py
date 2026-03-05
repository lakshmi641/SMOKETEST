"""
Firestore Client & Utilities
Provides async access to Firestore collections with tenant scoping
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor
import firebase_admin
from firebase_admin import firestore as fb_firestore

logger = logging.getLogger(__name__)


class FirestoreClient:
    """Tenant-scoped Firestore access"""
    
    _executor = ThreadPoolExecutor(max_workers=10)
    
    def __init__(self, company_id: str):
        """
        Initialize client for a specific tenant
        
        Args:
            company_id: Tenant identifier (scoped all queries)
        """
        self.company_id = company_id
        self.db = fb_firestore.client()
    
    async def get_collection(self, collection: str):
        """Get tenant-scoped collection reference"""
        return self.db.collection(f"companies/{self.company_id}/{collection}")
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    async def fetch_docs(self, collection: str, filters: Dict[str, Any] = None) -> List[Dict]:
        """
        Fetch documents from collection with optional filters
        
        Args:
            collection: Collection name (tenant-scoped)
            filters: Optional {field: value} filter dict
            
        Returns:
            List of document dicts with 'id' field
        """
        def _fetch():
            coll_ref = self.db.collection(f"companies/{self.company_id}/{collection}")
            
            if filters:
                query = coll_ref
                for field, value in filters.items():
                    query = query.where(field, "==", value)
                docs = query.stream()
            else:
                docs = coll_ref.stream()
            
            results = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                results.append(data)
            return results
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _fetch
        )
    
    async def get_doc(self, collection: str, doc_id: str) -> Optional[Dict]:
        """Get single document"""
        def _get():
            doc = self.db.collection(
                f"companies/{self.company_id}/{collection}"
            ).document(doc_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
            return None
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _get
        )
    
    async def fetch_docs_by_ids(self, collection: str, ids: List[str]) -> List[Dict]:
        """Fetch multiple documents by IDs"""
        def _fetch():
            coll_ref = self.db.collection(f"companies/{self.company_id}/{collection}")
            results = []
            for doc_id in ids:
                doc = coll_ref.document(doc_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    results.append(data)
            return results
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _fetch
        )
    
    async def count_docs(self, collection: str, filters: Dict[str, Any] = None) -> int:
        """Count documents in collection"""
        def _count():
            coll_ref = self.db.collection(f"companies/{self.company_id}/{collection}")
            if filters:
                query = coll_ref
                for field, value in filters.items():
                    query = query.where(field, "==", value)
                return query.count().get()[0][0].value
            else:
                return coll_ref.count().get()[0][0].value
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _count
        )
    
    # ========================================================================
    # Analytics Queries (used by tools)
    # ========================================================================
    
    async def get_tasks_by_status(self, status: str = None) -> List[Dict]:
        """Fetch tasks, optionally filtered by status"""
        filters = {"status": status} if status else None
        return await self.fetch_docs("generatedTasks", filters)
    
    async def get_active_tasks(self) -> List[Dict]:
        """Get all open/in-progress tasks"""
        def _get():
            coll_ref = self.db.collection(f"companies/{self.company_id}/generatedTasks")
            docs = coll_ref.where("status", "in", ["open", "in-progress"]).stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                results.append(data)
            return results
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _get
        )
    
    async def get_completed_tasks(
        self, 
        days: int = 7
    ) -> List[Dict]:
        """Get tasks completed in last N days"""
        def _get():
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            coll_ref = self.db.collection(f"companies/{self.company_id}/generatedTasks")
            docs = coll_ref.where("status", "==", "completed").where(
                "completedAt", ">=", cutoff_date
            ).stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                results.append(data)
            return results
        
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _get
        )
    
    async def get_projects(self) -> List[Dict]:
        """Fetch all projects"""
        return await self.fetch_docs("projects")
    
    async def get_project_tasks(self, project_id: str) -> List[Dict]:
        """Get all tasks for a project"""
        return await self.fetch_docs("generatedTasks", {"projectId": project_id})
    
    async def get_users(self) -> List[Dict]:
        """Fetch all users"""
        return await self.fetch_docs("users")
    
    async def get_workspaces(self) -> List[Dict]:
        """Fetch all workspaces"""
        return await self.fetch_docs("workspaces")
    
    async def get_positions(self) -> List[Dict]:
        """Fetch all positions"""
        return await self.fetch_docs("positions")
    
    async def get_position_assignments(self) -> List[Dict]:
        """Fetch all position-to-user assignments"""
        return await self.fetch_docs("positionAssignments")
    
    async def get_approval_instances(self, status: str = "pending") -> List[Dict]:
        """Fetch approval instances by status"""
        return await self.fetch_docs("approvalInstances", {"status": status})
    
    async def get_notifications(self, user_id: str = None) -> List[Dict]:
        """Fetch notifications, optionally for a user"""
        filters = {"userId": user_id} if user_id else None
        return await self.fetch_docs("notifications", filters)
    
    # ========================================================================
    # Parallel Batch Fetches (for dashboard aggregation)
    # ========================================================================
    
    async def fetch_dashboard_data(self) -> Dict[str, Any]:
        """
        Fetch all data needed for executive dashboard in parallel
        Used by multiple dashboard tools
        """
        tasks = await asyncio.gather(
            self.get_tasks_by_status(),
            self.get_projects(),
            self.get_workspaces(),
            self.get_users(),
            self.get_positions(),
            self.get_position_assignments(),
            self.get_approval_instances(),
            return_exceptions=True,
        )
        
        return {
            "tasks": tasks[0] if not isinstance(tasks[0], Exception) else [],
            "projects": tasks[1] if not isinstance(tasks[1], Exception) else [],
            "workspaces": tasks[2] if not isinstance(tasks[2], Exception) else [],
            "users": tasks[3] if not isinstance(tasks[3], Exception) else [],
            "positions": tasks[4] if not isinstance(tasks[4], Exception) else [],
            "position_assignments": tasks[5] if not isinstance(tasks[5], Exception) else [],
            "approval_instances": tasks[6] if not isinstance(tasks[6], Exception) else [],
        }
