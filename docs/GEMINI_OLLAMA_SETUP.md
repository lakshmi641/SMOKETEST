# CEO Visibility Agent - Gemini + Ollama Setup Guide

## Overview

The system now uses **LiteLLM as a routing proxy** with:
- **Primary LLM**: Gemini 2.0 Flash (fast, good tool-calling, cost-efficient)
- **Fallback LLM**: Ollama Llama2 (free, self-hosted, auto-fallback on Gemini failure)
- **Embeddings**: Ollama Nomic Embed Text (always local, 768d vectors, free)

## Updated Files

✅ **Configurations Updated**:
- `infra/docker/litellm_config.yml` - Gemini primary + Ollama fallback routing
- `infra/docker/docker-compose.yml` - Added Ollama service, wired all dependencies
- `infra/docker/cognee/.env` - Added GEMINI_API_KEY
- `agents/ceo-visibility/.env` - Added LITELLM_URL and GEMINI_API_KEY
- `agents/ceo-visibility/src/config.py` - Already uses "gemini-flash" model name

## Getting Started

### Step 1: Add Your Gemini API Key

Get free Gemini API key: https://aistudio.google.com/app/apikey

```bash
# Set environment variable
export GEMINI_API_KEY=your-actual-gemini-api-key

# Or add to .env files (these are created with placeholder)
# infra/docker/cognee/.env               → GEMINI_API_KEY=your-key
# agents/ceo-visibility/.env             → GEMINI_API_KEY=your-key
```

### Step 2: Start All Services

```bash
cd infra/docker

# Start all services (Postgres, Redis, Ollama, LiteLLM, Cognee API, CEO Agent)
docker-compose up -d

# Or with environment variable for Gemini key
GEMINI_API_KEY=your-key docker-compose up -d

# Check status
docker-compose ps
```

Services available at:
- **Cognee API**: http://localhost:8080
- **CEO Agent**: http://localhost:8081
- **LiteLLM Proxy**: http://localhost:8000
- **Ollama**: http://localhost:11434
- **Redis Insight**: http://localhost:8001
- **PostgreSQL**: localhost:5432

### Step 3: Start PMS Frontend

```bash
npm run dev
# Frontend at http://localhost:3000
```

### Step 4: Test Agent

1. **Navigate** to http://localhost:3000
2. **Login** with test credentials
3. **Go to** Executive Dashboard or /ceo-agent
4. **Ask** "How is my organization performing?"

## LLM Routing (Automatic Fallback)

### Routing Strategy

```
User Question
     ↓
LiteLLM Router
     ↓
Try: Gemini 2.0 Flash (Primary)
     ↓
Success? → Return Response
     ↓
Failure? → Auto-Fallback to Ollama Llama2
     ↓
Return Response from Ollama (free, self-hosted)
```

### Configuration (litellm_config.yml)

```yaml
model_list:
  # Primary (highest priority)
  - model_name: "gemini-flash"
    litellm_params:
      model: "gemini/gemini-2.0-flash"
      api_key: ${GEMINI_API_KEY}
      timeout: 300
      max_retries: 1
    router_settings:
      priority: 100  # Try first
  
  # Fallback (lower priority)
  - model_name: "local-llama"
    litellm_params:
      model: "ollama/llama2"
      base_url: "http://ollama:11434"
      timeout: 300
      max_retries: 2
    router_settings:
      priority: 10  # Try if Gemini fails

  # Embeddings (always local)
  - model_name: "nomic-embed-text"
    litellm_params:
      model: "ollama/nomic-embed-text"
      base_url: "http://ollama:11434"

router_settings:
  routing_strategy: "priority"
  fallback_timeout: 30
  fallback_routes:
    - model_name: "local-llama"
      weight: 1
```

## Environment Variables

### LiteLLM Service
```env
LITELLM_MASTER_KEY=sk-litellm-dev-key
GEMINI_API_KEY=your-actual-gemini-api-key        # Required for Gemini
LOG_LEVEL=debug
```

### Cognee API Service
```env
LITELLM_URL=http://litellm:8000
LITELLM_API_KEY=sk-litellm-dev-key
GEMINI_API_KEY=your-actual-gemini-api-key
COGNEE_DB_HOST=postgres
COGNEE_DB_PORT=5432
```

### CEO Agent Service
```env
LITELLM_URL=http://litellm:8000
LITELLM_API_KEY=sk-litellm-dev-key
GEMINI_API_KEY=your-actual-gemini-api-key
COGNEE_API_URL=http://cognee:8000
AGENT_MODEL=gemini-flash                         # Routes through LiteLLM
```

## Testing Routing

### Test Gemini (Primary)
```bash
curl -X POST http://localhost:8000/chat/completions \
  -H "Authorization: Bearer sk-litellm-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-flash",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "stream": false
  }'
```

### Test Ollama (Fallback)
```bash
curl -X POST http://localhost:8000/chat/completions \
  -H "Authorization: Bearer sk-litellm-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-llama",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "stream": false
  }'
```

### Check LiteLLM Logs
```bash
# See which model was used
docker logs cognee_litellm | grep -i model

# Watch in real-time
docker logs -f cognee_litellm | grep -i "completion"
```

## Costs

| Component | When Used | Cost |
|-----------|-----------|------|
| Gemini 2.0 Flash | Primary LLM | $75/1M input tokens, $0.30/1M output tokens |
| Ollama Llama2 | Fallback + Embeddings | $0 (self-hosted, already running) |
| **Total** | Demo usage | **$0-5/month** (very low volume) |

## Troubleshooting

### "GEMINI_API_KEY not set" error
```bash
# Set environment variable before starting containers
export GEMINI_API_KEY=your-key
docker-compose up -d
```

### LiteLLM can't reach Ollama
```bash
# Check Ollama is healthy
curl http://localhost:11434/api/tags

# If it fails, ensure ollama is running
docker ps | grep ollama
```

### Agent always falls back to Ollama
```bash
# Check if GEMINI_API_KEY is set in LiteLLM
docker exec cognee_litellm env | grep GEMINI_API_KEY

# Check LiteLLM logs for errors
docker logs cognee_litellm | grep -i "gemini\|error"
```

### Ollama models not available
```bash
# Pull models manually
docker exec cognee_ollama ollama pull llama2
docker exec cognee_ollama ollama pull nomic-embed-text

# Or wait 2-3 minutes for auto-pull (if enabled in docker-compose)
```

## Service Dependencies

```
                     ┌──────────────────────┐
                     │   CEO Agent (8081)   │
                     └──────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐
│  Cognee API      │  │ PostgreSQL   │  │ Redis Stack (8001) │
│  (8080)          │  │ (5432)       │  │ + Insight UI       │
└──────┬───────────┘  └──────┬───────┘  └────────┬───────────┘
       │                     │                   │
       └─────────────────────┼───────────────────┘
                             │
        ┌────────────────────┼─────────────────┐
        │                    │                 │
        ▼                    ▼                 ▼
┌──────────────┐  ┌──────────────────┐  ┌───────────────┐
│  LiteLLM     │  │ Ollama (11434)   │  │  Gemini API   │
│  (8000)      │  │ Llama2 + Embed   │  │  (cloud)      │
└──────────────┘  └──────────────────┘  └───────────────┘
```

## Production Deployment

For GCP Cloud Run deployment, see [DEPLOYMENT.md](../docs/CEO_VISIBILITY_AGENT_DEPLOYMENT.md)

**Key difference for production**:
- Replace docker-compose with Cloud Run services
- Use Secret Manager for GEMINI_API_KEY
- Use internal VPC for Ollama/Redis (if running on GKE)
- LiteLLM routes same way (no code changes needed)

---

**Next Steps**: Run `docker-compose up -d` and test the agent! 🚀
