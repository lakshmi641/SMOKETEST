"""
Knowledge Search Tool
Searches Cognee knowledge base for company information
"""

import logging
from typing import Any, Optional
import httpx

from ..models.schemas import KnowledgeSearchResponse, KnowledgeSearchResult
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def search_knowledge(
    query: str,
    limit: int = 5,
    agent: Any = None,
) -> KnowledgeSearchResponse:
    """
    Search company knowledge base via Cognee API
    """
    try:
        # Extract company_id from the agent context provided by Agno
        company_id = agent.context.get("company_id") if agent and agent.context else None

        if not company_id:
            raise ValueError("Critical Error: company_id missing from agent context.")

        # Call Cognee API
        async with httpx.AsyncClient() as client:
            cognee_url = f"{settings.cognee_api_url}/api/v1/search"
            
            payload = {
                "company_id": company_id,
                "query": query,
                "limit": limit,
                "threshold": 0.3,
            }
            
            headers = {}
            if settings.cognee_api_key:
                headers["Authorization"] = f"Bearer {settings.cognee_api_key}"
            
            response = await client.post(
                cognee_url,
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Parse results
            results = []
            for item in data.get("results", []):
                results.append(KnowledgeSearchResult(
                    text=item["text"],
                    document_name=item["document_name"],
                    score=item["score"],
                    metadata=item.get("metadata"),
                ))
            
            logger.info(f"Knowledge search for '{query}' returned {len(results)} results")
            
            return KnowledgeSearchResponse(
                query=query,
                results=results,
                total=len(results),
            )
            
    except httpx.HTTPError as e:
        logger.error(f"Cognee API error: {str(e)}")
        # Return empty results instead of failing
        return KnowledgeSearchResponse(
            query=query,
            results=[],
            total=0,
        )
    except Exception as e:
        logger.error(f"Error searching knowledge: {str(e)}")
        raise


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "search_knowledge",
        "description": "Search the company knowledge base for information. Uses hybrid search (vector + full-text) across ingested documents.",
        "fn": search_knowledge,
        "args": {
            "query": {
                "type": "string",
                "description": "Search query",
                "required": True,
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results (default 5)",
                "required": False,
            },
        }
    }
