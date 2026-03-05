# CEO Visibility Agent - Complete Setup & Architecture

**Date**: March 4, 2026  
**Status**: ✅ Ready for Local Development

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  PMS Frontend (Next.js)                         │
│              http://localhost:3000                              │
│  - Executive Dashboard with "Ask AI" button                     │
│  - Full-page CEO Agent at /ceo-agent                           │
│  - CopilotKit integration for streaming responses              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/JSON (Firebase JWT + X-Company-Id)
                       │ AG-UI SSE streaming
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│         CEO Visibility Agent (Python, Agno)                    │
│              http://localhost:8081                              │
│                                                                 │
│  Tools (9 total):                                              │
│   - Firestore: strategic_health, portfolio_status, velocity   │
│   - Firestore: risk_assessment, resources, approvals          │
│   - Firestore: workspace_performance                          │
│   - Cognee: search_knowledge, add_knowledge                  │
│                                                                 │
│  Model: Gemini Flash (via LiteLLM router)                    │
│  Memory: Redis sessions + PG chat history                    │
└───────────┬───────────────┬──────────────┬──────────────────────┘
            │               │              │
            ▼               ▼              ▼
     ┌──────────────┐ ┌───────────┐ ┌──────────────┐
     │ Cognee API   │ │ Firestore │ │ LiteLLM      │
     │ (8080)       │ │ (prod)    │ │ (8000)       │
     └──────────────┘ └───────────┘ └──────────────┘
            │                              │
            │     ┌────────────────────────┼────────────────┐
            │     │                        │                │
            ▼     ▼                        ▼                ▼
     ┌────────────────┐        ┌──────────────────┐  ┌───────────┐
     │ PostgreSQL     │        │ Ollama (11434)   │  │  Gemini   │
     │ (pgvector)     │        │ Llama2 + Embed   │  │  API      │
     │ 5432           │        │ (Fallback)       │  │  (cloud)  │
     └────────────────┘        └──────────────────┘  └───────────┘
            │
            ▼
     ┌──────────────────┐
     │ Redis Stack      │
     │ (6379)           │
     │ Cache + Sessions │
     └──────────────────┘
```

---

## Files Updated for Gemini + Ollama Setup

### 1. LiteLLM Configuration
**File**: `infra/docker/litellm_config.yml`
- ✅ Gemini as primary model (priority 100)
- ✅ Ollama as fallback (priority 10)
- ✅ Nomic Embed Text for embeddings
- ✅ Priority-based routing with auto-fallback
- ✅ Redis state tracking

### 2. Docker Compose
**File**: `infra/docker/docker-compose.yml`
- ✅ Added Ollama service (llama2 + embeddings)
- ✅ LiteLLM now depends on Ollama
- ✅ Cognee API depends on LiteLLM + Ollama
- ✅ CEO Agent depends on all services
- ✅ All services on `agentic` network

### 3. Environment Configuration
**Files**:
- `infra/docker/cognee/.env` - Added GEMINI_API_KEY + LITELLM_URL
- `agents/ceo-visibility/.env` - Added LITELLM_URL + GEMINI_API_KEY

### 4. Agent Configuration
**File**: `agents/ceo-visibility/src/config.py`
- ✅ Already defaults to "gemini-flash" model
- ✅ Uses LITELLM_URL for routing proxy
- ✅ Auto-fallback handled by LiteLLM

---

## Credentials Required

### 1. **Gemini API Key** (FREE - Required)
Get free key: https://aistudio.google.com/app/apikey

```bash
export GEMINI_API_KEY=your-actual-gemini-api-key
```

### 2. **PostgreSQL Credentials** ✅ (Already configured)
```env
COGNEE_DB_USER=cognee_user
COGNEE_DB_PASSWORD=cognee_password_dev
```

### 3. **Redis Password** ✅ (Already configured)
```env
REDIS_PASSWORD=redis_password_dev
```

### 4. **LiteLLM Master Key** ✅ (Already configured)
```env
LITELLM_API_KEY=sk-litellm-dev-key
```

---

## Quick Start (3 Commands)

### 1. Set Gemini API Key
```bash
export GEMINI_API_KEY=your-actual-gemini-api-key
```

### 2. Start All Services
```bash
cd infra/docker
docker-compose up -d
```

### 3. Start Frontend
```bash
npm run dev
```

**Then visit**: http://localhost:3000

---

## Service Status Check

```bash
# View all running services
cd infra/docker
docker-compose ps

# Expected output:
# NAME              STATUS
# cognee_postgres   Up (healthy)
# cognee_redis      Up (healthy)
# cognee_ollama     Up (healthy)
# cognee_litellm    Up
# cognee_api        Up
# ceo_agent         Up
```

---

## Testing the Agent

### Test 1: Firestore Tools (Real Data)
```bash
# Ask about organization health
curl -X POST http://localhost:8081/agui \
  -H "Authorization: Bearer test-token" \
  -H "X-Company-Id: test-company-id" \
  -d '{"messages": [], "userMessage": "How is my organization performing?"}'
```

### Test 2: Knowledge Search (Cognee)
```bash
# First, add a document
curl -X POST http://localhost:8080/add \
  -d '{
    "company_id": "test-company-id",
    "title": "Quarterly Report",
    "content": "Q4 goals: 20 tasks/week, 95% delivery..."
  }'

# Then ask agent
curl -X POST http://localhost:8081/agui \
  -H "Authorization: Bearer test-token" \
  -H "X-Company-Id: test-company-id" \
  -d '{"messages": [], "userMessage": "What were our Q4 targets?"}'
```

### Test 3: LLM Routing (Gemini Primary, Ollama Fallback)
```bash
# Check which model responds
docker logs cognee_litellm | grep -i "model\|gemini\|ollama"
```

---

## LLM Routing (Automatic Fallback)

### How It Works

1. **Agent requests "gemini-flash"** from LiteLLM
2. **LiteLLM tries Gemini first** (priority 100)
   - ✅ Success → Return response
   - ❌ Timeout/Quota/Error → Fallback
3. **LiteLLM tries Ollama Llama2** (priority 10)
   - ✅ Success → Return response (free)
   - ❌ Failure → Error logged

### Configuration (No Code Changes Needed)

```yaml
# litellm_config.yml routes automatically
router_settings:
  routing_strategy: "priority"
  fallback_timeout: 30  # seconds before fallback
  fallback_routes:
    - model_name: "local-llama"
      weight: 1
```

### Cost

| Model | Usage | Cost |
|-------|-------|------|
| Gemini 2.0 Flash | Primary (when working) | $75/1M input, $0.30/1M output |
| Ollama Llama2 | Fallback (when needed) | $0 (self-hosted) |
| Nomic Embed Text | Always (embeddings) | $0 (self-hosted) |
| **Total** | Demo usage (low volume) | **$0-5/month** |

---

## Troubleshooting

### Problem: "GEMINI_API_KEY not set"
```bash
# Solution
export GEMINI_API_KEY=your-key
docker-compose up -d
```

### Problem: "Connection refused on port 8081"
```bash
# Check if CEO Agent started
docker logs ceo_agent | tail -20

# Ensure Cognee API is running
curl http://localhost:8080/health
```

### Problem: Agent always uses Ollama (never Gemini)
```bash
# Check if GEMINI_API_KEY reached LiteLLM
docker exec cognee_litellm env | grep GEMINI_API_KEY

# Check LiteLLM logs for API errors
docker logs cognee_litellm | grep -i "gemini\|error"
```

### Problem: Ollama models not available
```bash
# Pull models manually
docker exec cognee_ollama ollama pull llama2
docker exec cognee_ollama ollama pull nomic-embed-text

# Wait ~2 minutes for auto-pull first
```

### Problem: PostgreSQL connection failed
```bash
# Check PostgreSQL is healthy
curl http://localhost:5432  # Should fail gracefully

# Check logs
docker logs cognee_postgres | tail -20
```

---

## Environment Variables Summary

### For docker-compose

```bash
# Required - set before `docker-compose up -d`
export GEMINI_API_KEY=your-actual-key

# Optional - defaults work for development
export LITELLM_MASTER_KEY=sk-litellm-dev-key
export REDIS_PASSWORD=redis_password_dev
```

### In Service Configs

**LiteLLM** (`litellm_config.yml`):
```yaml
environment:
  LITELLM_MASTER_KEY: sk-litellm-dev-key
  GEMINI_API_KEY: ${GEMINI_API_KEY}  # From export
  LOG_LEVEL: debug
```

**Cognee API** (`.env`):
```env
LITELLM_URL=http://litellm:8000
LITELLM_API_KEY=sk-litellm-dev-key
GEMINI_API_KEY=your-gemini-key
```

**CEO Agent** (`.env`):
```env
LITELLM_URL=http://litellm:8000
LITELLM_API_KEY=sk-litellm-dev-key
GEMINI_API_KEY=your-gemini-key
AGENT_MODEL=gemini-flash  # Routes through LiteLLM
```

---

## Next Steps

### Local Development
- [ ] Get Gemini API key (2 min)
- [ ] Set GEMINI_API_KEY env var
- [ ] Run `docker-compose up -d`
- [ ] Test agent from PMS dashboard
- [ ] Verify Gemini + Ollama routing in logs

### Production Deployment
- [ ] Follow [DEPLOYMENT.md](./CEO_VISIBILITY_AGENT_DEPLOYMENT.md)
- [ ] Deploy Cognee API to Cloud Run (Service 1)
- [ ] Deploy CEO Agent to Cloud Run (Service 2)
- [ ] Use Secret Manager for GEMINI_API_KEY
- [ ] Same LiteLLM routing, no code changes

---

## Reference Documentation

| Document | Purpose |
|----------|---------|
| [GEMINI_OLLAMA_SETUP.md](./GEMINI_OLLAMA_SETUP.md) | Detailed Gemini + Ollama configuration |
| [LOCAL_DEVELOPMENT_SETUP.md](../LOCAL_DEVELOPMENT_SETUP.md) | Original local dev guide (still valid) |
| [CEO_VISIBILITY_AGENT_IMPLEMENTATION.md](./CEO_VISIBILITY_AGENT_IMPLEMENTATION.md) | Full architecture + implementation |
| [CEO_VISIBILITY_AGENT_DEPLOYMENT.md](./CEO_VISIBILITY_AGENT_DEPLOYMENT.md) | GCP Cloud Run deployment |

---

**Status**: ✅ All files updated. Ready to run `docker-compose up -d`! 🚀

**Time to first test**: ~5 minutes (setup + containers starting)
