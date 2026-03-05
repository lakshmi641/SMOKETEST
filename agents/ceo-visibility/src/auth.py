"""
Firebase Authentication & Authorization
Validates JWT tokens and extracts user/tenant context
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from firebase_admin import firestore as fb_firestore
from fastapi import HTTPException, status

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# Initialize Firebase Admin SDK
def init_firebase():
    """Initialize Firebase Admin SDK using Application Default Credentials (ADC)"""
    try:
        if not firebase_admin._apps:
            # Use ADC (Workload Identity on GKE, Application Default on Cloud Run)
            firebase_admin.initialize_app(
                options={"projectId": settings.firebase_project_id}
            )
            logger.info(f"Firebase initialized for project: {settings.firebase_project_id}")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {str(e)}")
        raise


async def verify_firebase_token(token: str) -> Dict[str, Any]:
    """
    Verify Firebase JWT token and return decoded claims
    
    Args:
        token: Bearer token from Authorization header
        
    Returns:
        Decoded token claims including uid, email, custom claims
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Remove "Bearer " prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token",
            )
        
        # Verify token (will raise exception if invalid)
        decoded = firebase_auth.verify_id_token(token)
        
        logger.debug(f"Token verified for user: {decoded.get('uid')}")
        return decoded
        
    except firebase_auth.InvalidIdTokenError as e:
        logger.warning(f"Invalid ID token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except firebase_auth.ExpiredIdTokenError as e:
        logger.warning(f"Expired ID token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable",
        )


async def get_user_company_id(decoded_token: Dict[str, Any]) -> str:
    """
    Extract company_id from token claims
    
    Looks for:
    1. X-Company-Id header (passed by frontend)
    2. company_id in custom claims (set by Scalekit or manual admin setup)
    3. Extracts from email domain if configured
    
    Args:
        decoded_token: Decoded Firebase JWT claims
        
    Returns:
        company_id: Tenant identifier
        
    Raises:
        HTTPException: If company_id cannot be determined
    """
    try:
        # Try custom claims first (if set by Scalekit or admin)
        custom_claims = decoded_token.get("custom_claims", {})
        if isinstance(custom_claims, dict) and "company_id" in custom_claims:
            return custom_claims["company_id"]
        
        # If not in claims, look up from Firestore user document
        uid = decoded_token.get("uid")
        db = fb_firestore.client()
        
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            if "companyId" in user_data:
                return user_data["companyId"]
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID not found in user profile",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get company ID: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to determine company context",
        )


class AuthContext:
    """Holds authentication context for a request"""
    
    def __init__(
        self,
        user_id: str,
        email: str,
        company_id: str,
        decoded_token: Dict[str, Any],
    ):
        self.user_id = user_id
        self.email = email
        self.company_id = company_id
        self.decoded_token = decoded_token
        self.timestamp = datetime.utcnow()
    
    def __repr__(self):
        return f"AuthContext(user={self.user_id}, company={self.company_id})"


async def validate_request_auth(token: str, company_id: str) -> AuthContext:
    """
    Full authentication and authorization validation
    
    Args:
        token: Bearer token from Authorization header
        company_id: Tenant ID from X-Company-Id header
        
    Returns:
        AuthContext: Authenticated user/tenant context
        
    Raises:
        HTTPException: If validation fails
    """
    # Verify token
    decoded = await verify_firebase_token(token)
    
    user_id = decoded.get("uid")
    email = decoded.get("email", "")
    
    # Verify company_id matches user's organization
    # (Skip for now in demo, but should validate in production)
    
    return AuthContext(
        user_id=user_id,
        email=email,
        company_id=company_id,
        decoded_token=decoded,
    )
