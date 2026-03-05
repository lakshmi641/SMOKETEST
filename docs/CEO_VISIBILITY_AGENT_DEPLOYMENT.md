# CEO Visibility Agent - Production Deployment Guide

**Purpose**: Step-by-step instructions for deploying to GCP production environment  
**Target Environment**: GCP Cloud Run  
**Prerequisites**: GCP CLI, Docker, verified E2E tests

---

## Architecture Overview (Production)

```
Internet
   │
   ├─────────────────────────────────┐
   │                                 │
   ▼                                 ▼
PMS Frontend (Vercel)      CEO Visibility Agent
   (Vercel)                  (Cloud Run :8080)
   │                         │   │   │   │
   │   POST /agui (SSE)      │   │   │   │
   └────────────────────────►│   │   │   │
   Firebase JWT                  │   │   │
   X-Company-Id                  │   │   │
        ▲                        │   │   │
        │                    ┌───┴───┘   │
   Firebase Auth        Firestore      Firestore
  (Firebase)            (prod)         (prod)
                                       │
                            ┌──────────┤
                            │          │
        ┌───────────────────┘          │
        │                              │
        ▼                              ▼
   Cognee API             Cloud SQL   Cognee API
  (Cloud Run              (pgvector)  (Cloud Run :8000)
   :8000)                  & Redis
        │
        └─────────────────────┘
           VPC Connector
           (GKE internal)
```

---

## Phase 1: GCP Infrastructure Setup

### 1.1 Create Service Accounts

**Cognee API Service Account**
```bash
# Create service account
gcloud iam service-accounts create cognee-api-sa \
  --display-name="Cognee Knowledge API"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding julley-platform-dev \
  --member="serviceAccount:cognee-api-sa@julley-platform-dev.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding julley-platform-dev \
  --member="serviceAccount:cognee-api-sa@julley-platform-dev.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**CEO Agent Service Account**
```bash
# Create service account
gcloud iam service-accounts create ceo-agent-sa \
  --display-name="CEO Visibility Agent"

# Grant Firestore Viewer (read-only)
gcloud projects add-iam-policy-binding julley-platform-dev \
  --member="serviceAccount:ceo-agent-sa@julley-platform-dev.iam.gserviceaccount.com" \
  --role="roles/datastore.viewer"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding julley-platform-dev \
  --member="serviceAccount:ceo-agent-sa@julley-platform-dev.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run Invoker (for calling Cognee API)
gcloud projects add-iam-policy-binding julley-platform-dev \
  --member="serviceAccount:ceo-agent-sa@julley-platform-dev.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### 1.2 Create Secrets in Secret Manager

```bash
# Cognee DB Password
echo -n "$(openssl rand -base64 32)" | gcloud secrets create cognee-db-password --data-file=-

# LiteLLM Master Key (already exists, verify)
gcloud secrets versions list litellm-master-key

# Redis Password
echo -n "$(openssl rand -base64 32)" | gcloud secrets create redis-password --data-file=-

# Optional: Gemini API Key (for LiteLLM fallback)
gcloud secrets create gemini-api-key --data-file=- < <(echo -n "YOUR_GEMINI_KEY")
```

### 1.3 Verify Infrastructure

```bash
# Check Cloud SQL instance
gcloud sql instances describe julley-agentic-cloudsql --region=us-central1

# Check Redis instance (on GKE)
kubectl get pods -n agentic | grep redis

# Check Ollama (on GKE)
kubectl get pods -n agentic | grep ollama

# Check LiteLLM Proxy
gcloud run services describe litellm-proxy --region=us-central1

# Check VPC Connector
gcloud compute networks vpc-peering list --filter="name:agentic-connector"
```

---

## Phase 2: Build & Publish Docker Images

### 2.1 Build Cognee API Image

```bash
# Set variables
PROJECT_ID="julley-platform-dev"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev"
REPO="agentic"

# Build (must specify linux/amd64 for cross-platform)
docker build --platform linux/amd64 \
  -t ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:v1.0.0 \
  -t ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:latest \
  -f infra/docker/cognee/Dockerfile \
  infra/docker/cognee/

# Scan for vulnerabilities (optional)
docker scan ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:v1.0.0

# Push to Artifact Registry
docker push ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:v1.0.0
docker push ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:latest
```

### 2.2 Build CEO Agent Image

```bash
# Build
docker build --platform linux/amd64 \
  -t ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:v1.0.0 \
  -t ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:latest \
  -f agents/ceo-visibility/Dockerfile \
  agents/ceo-visibility/

# Scan for vulnerabilities (optional)
docker scan ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:v1.0.0

# Push to Artifact Registry
docker push ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:v1.0.0
docker push ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:latest
```

### 2.3 Verify Images

```bash
# List images in Artifact Registry
gcloud artifacts docker images list ${REGISTRY}/${PROJECT_ID}/${REPO}

# Inspect image metadata
gcloud artifacts docker images describe \
  ${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:v1.0.0
```

---

## Phase 3: Deploy Services to Cloud Run

### 3.1 Deploy Cognee API

```bash
# Set variables
COGNEE_API_IMAGE="${REGISTRY}/${PROJECT_ID}/${REPO}/cognee-api:v1.0.0"
COGNEE_SA="cognee-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Deploy
gcloud run deploy cognee-api \
  --image=${COGNEE_API_IMAGE} \
  --region=${REGION} \
  --vpc-connector=projects/${PROJECT_ID}/locations/${REGION}/connectors/agentic-connector \
  --min-instances=0 \
  --max-instances=5 \
  --memory=4Gi \
  --cpu=2 \
  --port=8000 \
  --timeout=300 \
  --no-allow-unauthenticated \
  --service-account=${COGNEE_SA} \
  --set-env-vars=\
COGNEE_DB_HOST=10.9.0.3,\
COGNEE_DB_PORT=5432,\
COGNEE_DB_NAME=cognee_db,\
COGNEE_DB_USER=cognee_user,\
LITELLM_URL=https://litellm-proxy-46276910499.us-central1.run.app,\
REDIS_HOST=redis-stack.agentic.svc.cluster.local,\
REDIS_PORT=6379,\
REDIS_DB=0 \
  --set-secrets=\
COGNEE_DB_PASSWORD=cognee-db-password:latest,\
LITELLM_API_KEY=litellm-master-key:latest,\
REDIS_PASSWORD=redis-password:latest

# Verify deployment
gcloud run services describe cognee-api --region=${REGION}

# Get service URL
COGNEE_URL=$(gcloud run services describe cognee-api \
  --region=${REGION} \
  --format='value(status.url)')
echo "Cognee API URL: $COGNEE_URL"
```

### 3.2 Deploy CEO Agent

```bash
# Set variables
AGENT_IMAGE="${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:v1.0.0"
AGENT_SA="ceo-agent-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Deploy
gcloud run deploy ceo-visibility-agent \
  --image=${AGENT_IMAGE} \
  --region=${REGION} \
  --vpc-connector=projects/${PROJECT_ID}/locations/${REGION}/connectors/agentic-connector \
  --min-instances=0 \
  --max-instances=3 \
  --memory=2Gi \
  --cpu=2 \
  --port=8080 \
  --timeout=300 \
  --allow-unauthenticated \
  --service-account=${AGENT_SA} \
  --set-env-vars=\
FIREBASE_PROJECT_ID=${PROJECT_ID},\
LITELLM_URL=https://litellm-proxy-46276910499.us-central1.run.app,\
LITELLM_MODEL=gemini-flash,\
COGNEE_API_URL=${COGNEE_URL},\
REDIS_HOST=redis-stack.agentic.svc.cluster.local,\
REDIS_PORT=6379,\
REDIS_DB=0,\
AGNO_DB_URL=postgresql://agno_user:PASSWORD@10.9.0.3:5432/agno_db,\
LOG_LEVEL=INFO \
  --set-secrets=\
LITELLM_API_KEY=litellm-master-key:latest,\
REDIS_PASSWORD=redis-password:latest

# Verify deployment
gcloud run services describe ceo-visibility-agent --region=${REGION}

# Get service URL
AGENT_URL=$(gcloud run services describe ceo-visibility-agent \
  --region=${REGION} \
  --format='value(status.url)')
echo "CEO Agent URL: $AGENT_URL"
```

---

## Phase 4: Configure Frontend

### 4.1 Update PMS Environment Variables (Vercel)

In Vercel project settings or `.env.production`:

```bash
NEXT_PUBLIC_CEO_AGENT_URL=${AGENT_URL}
# Example: https://ceo-visibility-agent-abc123.us-central1.run.app
```

### 4.2 Redeploy Frontend

```bash
# If using Vercel CLI
vercel deploy --prod

# Or trigger via git push to main branch
git push origin main
```

---

## Phase 5: Post-Deployment Verification

### 5.1 Health Checks

```bash
# Check Cognee API health
curl -s "${COGNEE_URL}/health" | jq .

# Check CEO Agent health
curl -s "${AGENT_URL}/health" | jq .

# Check service logs
gcloud run services logs read cognee-api --limit=50 --region=${REGION}
gcloud run services logs read ceo-visibility-agent --limit=50 --region=${REGION}
```

### 5.2 End-to-End Test

```bash
# Get valid Firebase token (from frontend)
TOKEN="<paste_valid_token>"

# Test agent with authentication
curl -X POST "${AGENT_URL}/agui" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "How is my organization performing?"
    }]
  }' | head -50
```

### 5.3 Monitor Cloud Run Services

```bash
# Set up monitoring
gcloud monitoring dashboards create --config-from-file=- << 'EOF'
{
  "displayName": "CEO Visibility Agent",
  "mosaicLayout": {
    "columns": 4,
    "tiles": [
      {
        "width": 2,
        "height": 2,
        "widget": {
          "title": "Cognee API - Request Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.service_name=\"cognee-api\""
                }
              }
            }]
          }
        }
      },
      {
        "xPos": 2,
        "width": 2,
        "height": 2,
        "widget": {
          "title": "CEO Agent - Request Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.service_name=\"ceo-visibility-agent\""
                }
              }
            }]
          }
        }
      }
    ]
  }
}
EOF
```

---

## Phase 6: Rollback Plan

If issues occur post-deployment:

### Option 1: Rollback to Previous Image

```bash
# Get previous image version
gcloud artifacts docker images list ${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent

# Deploy previous version
gcloud run deploy ceo-visibility-agent \
  --image=${REGISTRY}/${PROJECT_ID}/${REPO}/ceo-visibility-agent:v0.9.0 \
  --region=${REGION}
  # ... (other flags)
```

### Option 2: Quick Fix Deploy

If there's a configuration issue:
```bash
# Update environment variables
gcloud run services update ceo-visibility-agent \
  --region=${REGION} \
  --update-env-vars=LOG_LEVEL=DEBUG

# Verify update
gcloud run services describe ceo-visibility-agent --region=${REGION}
```

### Option 3: Route Traffic to Staging

If production needs investigation:
```bash
# Create temporary routing to staging version
gcloud run services update-traffic ceo-visibility-agent \
  --region=${REGION} \
  --to-revisions=REVISION:100
```

---

## Phase 7: Monitoring & Maintenance

### 7.1 Set Up Alerts

```bash
# Create alert policy for high error rate
gcloud alpha monitoring policies create \
  --display-name="CEO Agent - High Error Rate" \
  --notification-channels=CHANNEL_ID \
  --condition-display-name="Error rate > 5%" \
  --condition-filter='metric.type="run.googleapis.com/request_count" AND metric.status_code="500"' \
  --condition-threshold-value=5
```

### 7.2 Regular Backups

```bash
# Backup Cognee vector database
gcloud sql backups create \
  --instance=julley-agentic-cloudsql \
  --description="Cognee vector DB backup - $(date +%Y-%m-%d)"

# Verify backup
gcloud sql backups list --instance=julley-agentic-cloudsql
```

### 7.3 Log Analysis

```bash
# Check for errors in last hour
gcloud run services logs read ceo-visibility-agent \
  --region=${REGION} \
  --limit=200 | grep -i "error\|exception\|timeout"

# Analyze request latency
gcloud run services logs read ceo-visibility-agent \
  --region=${REGION} \
  --limit=100 | grep "response_time"
```

---

## Troubleshooting Production Issues

### Issue: Service fails to start
**Check logs**:
```bash
gcloud run services logs read ceo-visibility-agent --region=${REGION} --limit=50
```

**Common causes**:
- Invalid secrets (check names in Secret Manager)
- Firestore authentication (use Workload Identity)
- VPC connectivity (verify Cloud SQL IP reachable)

### Issue: High latency
**Check**:
```bash
# Monitor resource utilization
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/execution_times" AND resource.label.service_name="ceo-visibility-agent"'

# Scale up if needed
gcloud run services update ceo-visibility-agent \
  --region=${REGION} \
  --min-instances=1 \
  --max-instances=10
```

### Issue: Cognee connectivity
```bash
# Check Cloud SQL connectivity
gcloud sql connect julley-agentic-cloudsql \
  --user=postgres \
  --psql

# Inside psql, check pgvector extension
\dx pgvector

# Check if cognee_db exists
\l cognee_db
```

---

## Security Checklist

- [ ] Service accounts have minimal required permissions
- [ ] Secrets managed via Secret Manager (not in code/env files)
- [ ] Cloud Run services use service-to-service authentication
- [ ] VPC connector restricts network access
- [ ] Firestore rules enforce tenant isolation
- [ ] Cloud SQL backups encrypted and stored
- [ ] Docker images scanned for vulnerabilities
- [ ] API endpoints have rate limiting (via LB or API Gateway)
- [ ] Audit logging enabled for all services
- [ ] Emergency access procedure documented

---

## Success Criteria

Production deployment successful when:
- ✅ All services start without error
- ✅ Health checks pass
- ✅ E2E tests pass against production
- ✅ No data leakage between tenants
- ✅ Response times within SLA (<10s typical)
- ✅ Error rates <0.1%
- ✅ Monitoring and alerting operational

---

## Support & Escalation

**Issues requiring investigation**:
1. Check Cloud Run service logs
2. Review Firestore quota usage
3. Verify Cloud SQL connectivity
4. Check LiteLLM proxy status
5. Review VPC connector logs

**Escalation contacts**:
- Platform team: platform@julley.com
- Infrastructure team: infra@julley.com
- On-call: [PagerDuty link]

---

**Deployment complete!** Monitor services closely for first 24 hours.
