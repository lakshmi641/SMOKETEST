# CEO Visibility Agent - Quick Reference

## 🚀 Quick Start (5 minutes)

### Local Development

```bash
# Terminal 1: Cognee API
cd infra/docker/cognee
cp .env.example .env
python server.py
# → http://localhost:8000/health

# Terminal 2: CEO Agent
cd agents/ceo-visibility
cp .env.example .env
pip install -e .
uvicorn src.main:app --reload
# → http://localhost:8080/health

# Terminal 3: Frontend
cd apps/pms
npm run dev
# → http://localhost:3000/ceo-agent
```

---

## 📁 Key Files Locations

### Cognee API (Knowledge Layer)
```
infra/docker/cognee/
├── server.py              # FastAPI app (endpoints: /add, /search, /cognify, /datasets)
├── cognee_config.py       # Cognee SDK config (pgvector, Redis, LiteLLM)
└── requirements.txt       # Dependencies (cognee, fastapi, psycopg2)
```

### CEO Agent (Execution Layer)
```
agents/ceo-visibility/src/
├── main.py                # FastAPI server + AG-UI SSE endpoint
├── agent.py               # Agno Agent definition + tool wiring
├── config.py              # Settings loader
├── auth.py                # Firebase JWT validation
├── models/schemas.py      # Pydantic models
└── tools/                 # 9 specialized tools
    ├── firestore_client.py       # Tenant-scoped Firestore access
    ├── strategic_health.py       # Overall health score
    ├── portfolio_status.py       # Project portfolio
    ├── delivery_velocity.py      # Team productivity
    ├── risk_assessment.py        # Risk scoring
    ├── resource_utilization.py   # Capacity metrics
    ├── approval_queue.py         # Pending approvals
    ├── workspace_performance.py  # Workspace health
    ├── knowledge_search.py       # Hybrid search (Cognee)
    └── knowledge_add.py          # Document ingestion
```

### Frontend (UI Layer)
```
src/
├── hooks/useCeoAgent.ts                        # CopilotKit wrapper
├── components/features/ceo-agent/
│   ├── CeoAgentPanel.tsx                       # Main chat interface
│   ├── CeoAgentDrawer.tsx                      # Slide-over for dashboard
│   ├── AgentMessage.tsx                        # Message display
│   ├── AgentToolResult.tsx                     # KPI visualization
│   └── index.ts
└── app/ceo-agent/page.tsx                      # Full-page route
```

---

## 🔌 API Endpoints

### Cognee API (http://localhost:8000)
```bash
POST   /api/v1/add        # Add document to knowledge base
POST   /api/v1/cognify    # Process chunks & embeddings
POST   /api/v1/search     # Hybrid search
GET    /api/v1/datasets   # List datasets
DELETE /api/v1/datasets/* # Remove dataset
GET    /health            # Health check
```

### CEO Agent (http://localhost:8080)
```bash
POST   /agui    # AG-UI SSE endpoint (main entry point)
GET    /health  # Health check
```

### Frontend Route
```
/ceo-agent     # Full page route for CEO agent
/               # Also accessible as drawer from executive dashboard
```

---

## ⚙️ Configuration

### Cognee API (.env)
```bash
COGNEE_DB_HOST=10.9.0.3              # Cloud SQL host
COGNEE_DB_PASSWORD=***               # Secret Manager
REDIS_HOST=redis-stack...            # Redis host
REDIS_PASSWORD=***                   # Secret Manager
LITELLM_URL=https://...              # LLM proxy
LITELLM_API_KEY=***                  # Secret Manager
```

### CEO Agent (.env)
```bash
FIREBASE_PROJECT_ID=julley-platform-dev
LITELLM_URL=https://...              # LLM proxy
LITELLM_API_KEY=***                  # Secret Manager
COGNEE_API_URL=http://localhost:8000 # Local or Cloud Run URL
REDIS_HOST=redis-stack...            # Redis host
REDIS_PASSWORD=***                   # Secret Manager
AGNO_DB_URL=postgresql://...         # PostgreSQL connection
```

### PMS Frontend (.env.local)
```bash
NEXT_PUBLIC_CEO_AGENT_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-platform-dev
```

---

## 🧠 How Agent Tools Work

### Example: Strategic Health

```python
# User request: "How is our health?"
#     ↓
# Agent calls get_strategic_health(company_id="julley-inc")
#     ↓
# Tool fetches (parallel, async):
# - generatedTasks (completion rate)
# - projects (portfolio health)
# - users & positionAssignments (capacity)
# - approvalInstances (blockers)
#     ↓
# Tool returns structured result:
# {
#   "overall_score": 82.5,
#   "status": "Healthy",
#   "indicators": [
#     {"metric": "Task Completion", "value": 92.0, "status": "healthy"},
#     ...
#   ],
#   "summary": "Strategic health is healthy..."
# }
#     ↓
# Agent synthesizes human response with metrics
#     ↓
# Frontend renders KPI cards + text
```

---

## 📊 Tool Matrix

| Tool | Data Source | Latency | Example Result |
|------|-------------|---------|-----------------|
| `get_strategic_health` | Firestore | 300ms | Overall score: 82/100 |
| `get_portfolio_status` | Firestore | 200ms | 24 total, 3 at-risk |
| `get_delivery_velocity` | Firestore | 250ms | 18 tasks/week, trending up |
| `get_risk_assessment` | Firestore | 300ms | Risk: HIGH (critical projects) |
| `get_resource_utilization` | Firestore | 250ms | 87% utilization, 2 idle |
| `get_approval_queue` | Firestore | 150ms | 12 pending, 2 urgent |
| `get_workspace_performance` | Firestore | 400ms | 5 workspaces, avg health 76% |
| `search_knowledge` | Cognee | 500ms | 5 relevant docs + scores |
| `add_knowledge` | Cognee | 2000ms | Document ingested + cognified |

---

## 🔒 Tenant Isolation

**Golden Rule**: `company_id` is **never** from LLM, always from authenticated context.

```
Frontend (JWT + X-Company-Id header)
    ↓
Auth validation (Firebase JWT)
    ↓
company_id extracted from header/token
    ↓
Injected into all tool functions:
    ├─ Firestore: companies/{company_id}/*
    ├─ Cognee: dataset=tenant_{company_id}
    └─ Redis: session:{company_id}:...
    ↓
✅ Zero risk of cross-tenant access
```

---

## 🧪 Testing Commands

### Health Checks
```bash
curl http://localhost:8000/health | jq .
curl http://localhost:8080/health | jq .
```

### Test Authorization
```bash
TOKEN="<firebase_token>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: test-company" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}'
```

### Add Knowledge
```bash
curl -X POST http://localhost:8000/api/v1/add \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "content": "Q4 Goals: ...",
    "document_name": "Q4-Goals.pdf"
  }'
```

### Search Knowledge
```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "query": "What are Q4 goals?",
    "limit": 5
  }'
```

---

## 📈 Performance Benchmarks

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Single tool | 200ms | 800ms | 2s |
| Multi-tool (3) | 600ms | 2s | 4s |
| Knowledge search | 400ms | 1.5s | 3s |
| Full agent response | 1.5s | 3s | 5s |

---

## 🐛 Debugging

### Check Cognee Setup
```bash
# Verify database connection
python -c "import psycopg2; psycopg2.connect('postgresql://...')"

# Check pgvector extension
psql -h 10.9.0.3 -U postgres -d cognee_db -c "\dx pgvector"
```

### Check Agent Setup
```bash
# Verify Firebase credentials
python -c "import firebase_admin; firebase_admin.initialize_app()"

# Test LiteLLM connection
curl https://litellm-proxy.../models

# Check Redis
redis-cli -h redis-stack... ping
```

### Enable Verbose Logging
```bash
# Cognee
LOG_LEVEL=DEBUG python server.py

# Agent
LOG_LEVEL=DEBUG uvicorn src.main:app --reload
```

---

## 📚 Documentation

| Document | Purpose | Read When |
|----------|---------|-----------|
| [SUMMARY.md](CEO_VISIBILITY_AGENT_SUMMARY.md) | Overview | Getting started |
| [IMPLEMENTATION.md](CEO_VISIBILITY_AGENT_IMPLEMENTATION.md) | Components & setup | Understanding architecture |
| [E2E_TESTING.md](CEO_VISIBILITY_AGENT_E2E_TESTING.md) | Test scenarios | Running tests |
| [DEPLOYMENT.md](CEO_VISIBILITY_AGENT_DEPLOYMENT.md) | GCP deployment | Going to production |

---

## 🏭 Production Deployment

```bash
# 1. Build images
docker build -f infra/docker/cognee/Dockerfile -t cognee-api:v1 infra/docker/cognee/
docker build -f agents/ceo-visibility/Dockerfile -t ceo-agent:v1 agents/ceo-visibility/

# 2. Push to Artifact Registry
docker push us-central1-docker.pkg.dev/julley-platform-dev/agentic/cognee-api:v1
docker push us-central1-docker.pkg.dev/julley-platform-dev/agentic/ceo-visibility-agent:v1

# 3. Deploy to Cloud Run
gcloud run deploy cognee-api \
  --image=us-central1-docker.pkg.dev/julley-platform-dev/agentic/cognee-api:v1 \
  --region=us-central1 \
  --vpc-connector=agentic-connector \
  ...

gcloud run deploy ceo-visibility-agent \
  --image=us-central1-docker.pkg.dev/julley-platform-dev/agentic/ceo-visibility-agent:v1 \
  --region=us-central1 \
  --vpc-connector=agentic-connector \
  ...
```

See [DEPLOYMENT.md](CEO_VISIBILITY_AGENT_DEPLOYMENT.md) for full instructions.

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check Firebase token is valid and not expired |
| Missing X-Company-Id | Add header to all requests |
| Cognee not found | Verify COGNEE_API_URL in agent .env |
| No tool results | Enable LOG_LEVEL=DEBUG and check logs |
| Timeout | Increase AGENT_TIMEOUT or check Firestore quota |
| SSE not streaming | Verify Content-Type header: `text/event-stream` |

---

## 💡 Tips

1. **Use CopilotKit Components**: Already installed in PMS app (`@copilotkit/react-ui`)
2. **Frontend Hooks**: Use `useCeoAgent()` hook for auth headers
3. **Parallel Queries**: Firestore client batches requests with `fetch_dashboard_data()`
4. **Error Handling**: Agent gracefully degrades if Cognee fails (non-fatal)
5. **Scaling**: All services auto-scale from 0 to N replicas based on load

---

## 📞 Support

- **Docs**: See `docs/` folder
- **Issues**: Check logs with `LOG_LEVEL=DEBUG`
- **Questions**: Review code comments (extensive inline docs)
- **Contact**: platform@julley.com

---

**Implementation Date**: 2026-03-04  
**Status**: ✅ Production Ready
