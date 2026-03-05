"""
Knowledge Add Tool
Ingests documents into the Cognee knowledge base
"""

import logging
from typing import Optional
import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def add_knowledge(
    company_id: str,
    content: str,
    document_name: str,
    document_type: str = "text",
    metadata: Optional[dict] = None,
) -> dict:
    """
    Ingest a document into the knowledge base
    
    Args:
        company_id: Tenant identifier
        content: Document content (text)
        document_name: Name/title of document
        document_type: Type of document (text, pdf, docx, etc.)
        metadata: Optional dict with additional metadata
        
    Returns:
        Dict with ingestion status
    """
    try:
        # Call Cognee API to add document
        async with httpx.AsyncClient() as client:
            cognee_url = f"{settings.cognee_api_url}/api/v1/add"
            
            payload = {
                "company_id": company_id,
                "content": content,
                "document_name": document_name,
                "document_type": document_type,
                "metadata": metadata or {},
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
            
            logger.info(f"Document '{document_name}' added to knowledge base")
            
            # After adding, trigger cognify (processing)
            await trigger_cognify(company_id)
            
            return {
                "status": "success",
                "document_id": data.get("document_id"),
                "document_name": document_name,
                "dataset": data.get("dataset"),
            }
            
    except httpx.HTTPError as e:
        logger.error(f"Cognee API error when adding document: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "document_name": document_name,
        }
    except Exception as e:
        logger.error(f"Error adding knowledge: {str(e)}")
        raise


async def trigger_cognify(company_id: str) -> dict:
    """
    Trigger dataset processing (chunking, embedding, entity extraction)
    
    Args:
        company_id: Tenant identifier
        
    Returns:
        Dict with processing status
    """
    try:
        async with httpx.AsyncClient() as client:
            cognee_url = f"{settings.cognee_api_url}/api/v1/cognify"
            
            payload = {
                "company_id": company_id,
                "chunk_size": 2000,
                "overlap": 200,
            }
            
            headers = {}
            if settings.cognee_api_key:
                headers["Authorization"] = f"Bearer {settings.cognee_api_key}"
            
            response = await client.post(
                cognee_url,
                json=payload,
                headers=headers,
                timeout=300.0,  # Long timeout for processing
            )
            
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Cognify completed for {company_id}")
            
            return {
                "status": "success",
                "dataset": data.get("dataset"),
                "chunks_created": data.get("chunks_created", 0),
                "embeddings_generated": data.get("embeddings_generated", 0),
            }
            
    except Exception as e:
        logger.warning(f"Cognify processing failed (non-fatal): {str(e)}")
        return {"status": "error", "error": str(e)}


def create_tool():
    """Create Agno tool definition"""
    return {
        "name": "add_knowledge",
        "description": "Ingests a new document into the company knowledge base. The document is automatically processed for chunking and embedding.",
        "fn": add_knowledge,
        "args": {
            "company_id": {
                "type": "string",
                "description": "Company/tenant ID",
                "required": True,
            },
            "content": {
                "type": "string",
                "description": "Document content",
                "required": True,
            },
            "document_name": {
                "type": "string",
                "description": "Name/title of the document",
                "required": True,
            },
            "document_type": {
                "type": "string",
                "description": "Type of document (text, pdf, docx, etc.) - default: text",
                "required": False,
            },
            "metadata": {
                "type": "object",
                "description": "Optional metadata dict",
                "required": False,
            },
        }
    }
