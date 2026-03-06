"""
Cognee API Server
FastAPI wrapper for Cognee SDK with tenant-scoped endpoints (/api/v1/*)
Provides document ingestion, processing, and hybrid search capabilities
"""

import os
import logging
import time
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import cognee

from cognee_config import configure_cognee, CogneeSettings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Cognee Knowledge API",
    description="Shared knowledge service for intelligent agents",
    version="1.0.0",
)

# Global Cognee instance
cognee_agent = None
settings = CogneeSettings()


@app.on_event("startup")
async def startup():
    """Initialize Cognee on startup"""
    global cognee_agent
    try:
        logger.info("Initializing Cognee SDK...")
        cognee_agent = configure_cognee()
        logger.info("Cognee SDK initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Cognee: {str(e)}")
        raise


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "cognee-api",
        "version": "1.0.0",
    }


# ============================================================================
# Pydantic Models
# ============================================================================

class AddDocumentRequest(BaseModel):
    """Request to ingest a document"""
    company_id: str
    content: str
    document_name: str
    document_type: Optional[str] = "text"  # text, pdf, docx, etc.
    metadata: Optional[dict] = None


class CognifyRequest(BaseModel):
    """Request to process a dataset"""
    company_id: str
    chunk_size: Optional[int] = None
    overlap: Optional[int] = 200


class SearchRequest(BaseModel):
    """Request to search knowledge base"""
    company_id: str
    query: str
    limit: Optional[int] = 5
    threshold: Optional[float] = 0.3  # Relevance threshold (0-1)


class SearchResult(BaseModel):
    """Search result item"""
    text: str
    score: float  # Cosine similarity or BM25 score
    document_name: str
    metadata: Optional[dict] = None


class SearchResponse(BaseModel):
    """Response from search"""
    query: str
    results: List[SearchResult]
    total: int


class DatasetInfo(BaseModel):
    """Information about a dataset"""
    name: str
    document_count: int
    chunk_count: int
    created_at: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def get_dataset_name(company_id: str) -> str:
    """Generate tenant-scoped dataset name"""
    return f"tenant_{company_id}"


async def validate_tenant(request: Request, company_id: str) -> bool:
    """
    Validate that the requesting service/user is authorized for this tenant
    In production, validate JWT or service-to-service auth here
    """
    # For Phase 1 demo: accept all requests
    # In production: validate Authorization header or service account
    auth_header = request.headers.get("Authorization", "")
    return bool(company_id)  # Basic validation: company_id must be present


# ============================================================================
# API Endpoints: Document Management
# ============================================================================

@app.post("/api/v1/add")
async def add_document(request: Request, payload: AddDocumentRequest):
    """
    Ingest a raw document into tenant dataset
    
    Endpoint: POST /api/v1/add
    Request:
    {
        "company_id": "julley-inc",
        "content": "Q4 Safety Report...",
        "document_name": "q4-safety-report.pdf",
        "document_type": "pdf",
        "metadata": {"category": "safety", "year": 2024}
    }
    Response:
    {
        "status": "success",
        "dataset": "tenant_julley-inc",
        "document_id": "doc-uuid",
        "document_name": "q4-safety-report.pdf"
    }
    """
    try:
        # Validate tenant
        if not await validate_tenant(request, payload.company_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this tenant")
        
        dataset_name = get_dataset_name(payload.company_id)
        
        logger.info(f"Adding document to dataset: {dataset_name}")
        
        # Add document to Cognee (this persists to PostgreSQL)
        # Note: cognee.add_data_source() is async in newer versions
        document_id = await cognee_agent.add_data_source(
            dataset_id=dataset_name,
            data_source_type="text",
            data_source_value=payload.content,
            metadata={
                "document_name": payload.document_name,
                "document_type": payload.document_type,
                **(payload.metadata or {})
            }
        )
        
        return JSONResponse({
            "status": "success",
            "dataset": dataset_name,
            "document_id": str(document_id),
            "document_name": payload.document_name,
        })
        
    except Exception as e:
        logger.error(f"Error adding document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add document: {str(e)}")


@app.post("/api/v1/cognify")
async def cognify_dataset(request: Request, payload: CognifyRequest):
    """
    Process a dataset: chunk documents, generate embeddings, extract entities
    
    Endpoint: POST /api/v1/cognify
    Request:
    {
        "company_id": "julley-inc",
        "chunk_size": 2000,
        "overlap": 200
    }
    Response:
    {
        "status": "success",
        "dataset": "tenant_julley-inc",
        "chunks_created": 45,
        "embeddings_generated": 45,
        "processing_time_seconds": 12.5
    }
    """
    try:
        # Validate tenant
        if not await validate_tenant(request, payload.company_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this tenant")
        
        dataset_name = get_dataset_name(payload.company_id)
        
        logger.info(f"Processing dataset: {dataset_name}")
        
        # Cognify dataset (chunk + embed + extract)
        # This runs the data processing pipeline
        start_time = time.time()
        
        await cognee_agent.cognify(
            dataset_ids=[dataset_name],
            chunk_size=payload.chunk_size or settings.cognee_max_chunk_size,
            chunk_overlap=payload.overlap,
        )
        
        processing_time = time.time() - start_time
        
        logger.info(f"Cognify complete for {dataset_name} ({processing_time:.2f}s)")
        
        # TODO: Get actual counts from Cognee after processing
        return JSONResponse({
            "status": "success",
            "dataset": dataset_name,
            "chunks_created": 0,  # Update with actual from Cognee
            "embeddings_generated": 0,
            "processing_time_seconds": round(processing_time, 2),
        })
        
    except Exception as e:
        logger.error(f"Error cognifying dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")


# ============================================================================
# API Endpoints: Search
# ============================================================================

@app.post("/api/v1/search")
async def search_knowledge(request: Request, payload: SearchRequest) -> SearchResponse:
    """
    Hybrid search (vector + full-text) on tenant dataset
    
    Endpoint: POST /api/v1/search
    Request:
    {
        "company_id": "julley-inc",
        "query": "What are the safety protocols for construction?",
        "limit": 5,
        "threshold": 0.3
    }
    Response:
    {
        "query": "What are the safety protocols for construction?",
        "results": [
            {
                "text": "Safety protocols for construction include...",
                "score": 0.89,
                "document_name": "q4-safety-report.pdf",
                "metadata": {"category": "safety"}
            }
        ],
        "total": 1
    }
    """
    try:
        # Validate tenant
        if not await validate_tenant(request, payload.company_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this tenant")
        
        dataset_name = get_dataset_name(payload.company_id)
        
        logger.info(f"Searching dataset {dataset_name} for: {payload.query}")
        
        # Perform hybrid search via Cognee
        # Cognee returns ranked results by relevance
        search_results = await cognee_agent.search(
            query=payload.query,
            datasets=[dataset_name],
            limit=payload.limit,
        )
        
        # Format results
        results = []
        for result in search_results:
            results.append(SearchResult(
                text=result.get("text", ""),
                score=result.get("score", 0.0),
                document_name=result.get("document_name", "unknown"),
                metadata=result.get("metadata"),
            ))
        
        return SearchResponse(
            query=payload.query,
            results=results,
            total=len(results),
        )
        
    except Exception as e:
        logger.error(f"Error searching knowledge base: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# ============================================================================
# API Endpoints: Dataset Management
# ============================================================================

@app.get("/api/v1/datasets")
async def list_datasets(request: Request, company_id: Optional[str] = None):
    """
    List all datasets (optionally filtered by company_id prefix)
    
    Endpoint: GET /api/v1/datasets?company_id=julley-inc
    Response:
    {
        "datasets": [
            {
                "name": "tenant_julley-inc",
                "document_count": 3,
                "chunk_count": 145,
                "created_at": "2026-03-03T12:00:00Z"
            }
        ],
        "total": 1
    }
    """
    try:
        # If company_id provided, only return that dataset
        if company_id:
            if not await validate_tenant(request, company_id):
                raise HTTPException(status_code=403, detail="Unauthorized access to this tenant")
            
            dataset_name = get_dataset_name(company_id)
            # TODO: Query Cognee for dataset info
            return JSONResponse({
                "datasets": [{
                    "name": dataset_name,
                    "document_count": 0,
                    "chunk_count": 0,
                }],
                "total": 1,
            })
        
        # List all tenant datasets
        # TODO: Query Cognee for all datasets with tenant_ prefix
        return JSONResponse({
            "datasets": [],
            "total": 0,
        })
        
    except Exception as e:
        logger.error(f"Error listing datasets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")


@app.delete("/api/v1/datasets/{dataset_name}")
async def delete_dataset(request: Request, dataset_name: str, company_id: str = None):
    """
    Delete a dataset (only the dataset owner can delete)
    
    Endpoint: DELETE /api/v1/datasets/tenant_julley-inc?company_id=julley-inc
    Response:
    {
        "status": "success",
        "dataset": "tenant_julley-inc",
        "deleted": true
    }
    """
    try:
        # Extract company_id from dataset name
        if not dataset_name.startswith("tenant_"):
            raise HTTPException(status_code=400, detail="Invalid dataset name format")
        
        extracted_company_id = dataset_name.replace("tenant_", "")
        
        # Validate tenant
        if not await validate_tenant(request, extracted_company_id):
            raise HTTPException(status_code=403, detail="Unauthorized access to this tenant")
        
        logger.info(f"Deleting dataset: {dataset_name}")
        
        # Delete dataset
        await cognee_agent.delete_dataset(dataset_id=dataset_name)
        
        return JSONResponse({
            "status": "success",
            "dataset": dataset_name,
            "deleted": True,
        })
        
    except Exception as e:
        logger.error(f"Error deleting dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
