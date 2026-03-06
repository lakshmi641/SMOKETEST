"""
CEO Visibility Agent - FastAPI Server
Exposes AG-UI endpoint for server-sent events (SSE) streaming
"""

import logging
import asyncio
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from agent import create_ceo_agent, init_agent_system
from auth import validate_request_auth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize settings and app
settings = get_settings()
app = FastAPI(
    title="CEO Visibility Agent",
    description="Agentic intelligence for executive visibility - AG-UI SSE interface",
    version="1.0.0",
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to known frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize systems on server startup"""
    try:
        await init_agent_system()
        logger.info("CEO Visibility Agent server started")
    except Exception as e:
        logger.error(f"Startup error: {str(e)}")
        raise


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "ceo-visibility-agent",
        "version": "1.0.0",
    }


@app.post("/agui")
async def agui_endpoint(request: Request):
    """
    AG-UI Server-Sent Events (SSE) Endpoint
    
    Receives:
    - Authorization header: Bearer {Firebase JWT token}
    - X-Company-Id header: {tenant id}
    - Body: User message for the agent
    
    Returns:
    - SSE stream with agent response + tool calls
    
    Example:
    ```bash
    curl -X POST http://localhost:8080/agui \
      -H "Authorization: Bearer {token}" \
      -H "X-Company-Id: julley-inc" \
      -H "Content-Type: application/json" \
      -d '{"messages": [{"role": "user", "content": "How is our health?"}]}'
    ```
    """
    try:
        # Extract auth headers
        auth_header = request.headers.get("Authorization", "")
        company_id = request.headers.get("X-Company-Id", "")
        
        if not auth_header or not company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Authorization or X-Company-Id header",
            )
        
        # Validate authentication
        try:
            auth_context = await validate_request_auth(auth_header, company_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Auth validation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error",
            )
        
        # Parse request body
        try:
            body = await request.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request body",
            )
        
        # Extract messages (AG-UI sends conversation history)
        messages = body.get("messages", [])
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No messages provided",
            )
        
        # Get latest user message
        latest_message = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                latest_message = msg.get("content", "")
                break
        
        if not latest_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user message found",
            )
        
        logger.info(f"Agent request from {auth_context.email}: {latest_message[:100]}")
        
        # Create agent instance for this user
        agent = create_ceo_agent(
            company_id=company_id,
            user_id=auth_context.user_id,
        )
        
        # Stream generator for SSE
        async def generate_stream():
            """Generate AG-UI SSE events"""
            try:
                # Pass latest message and ensure context-based tool execution
                response_stream = agent.arun(
                    latest_message,
                    stream=True,
                    stream_events=True,
                )

                async for chunk in response_stream:
                    # The chunk is already a JSON string from Agno's SSE stream format
                    yield f"data: {chunk}\n\n"

                # Signal completion
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                logger.error(f"Stream generation error: {str(e)}")
                # Format error as a JSON object for the client
                error_msg = f'{{"error": "Agent error: {str(e)}"}}'
                yield f"data: {error_msg}\n\n"
        
        # Return streaming response with SSE content-type
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AG-UI endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "CEO Visibility Agent",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "agent": "/agui",
        },
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )
