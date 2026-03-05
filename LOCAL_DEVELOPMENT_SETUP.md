# CEO Visibility Agent - Local Development Setup

## Quick Start (3 Steps)

### 1. **Set Your API Keys**
```bash
# Add your real Gemini API key for local testing
export GEMINI_API_KEY=your-actual-key
```

### 2. **Start All Services**
```bash
cd infra/docker
docker-compose up -d
```

Services will be available at:
- **Cognee API**: http://localhost:8080
- **CEO Agent**: http://localhost:8081
- **Redis Insight**: http://localhost:8001
- **PostgreSQL**: localhost:5432

### 3. **Start PMS Frontend**
```bash
npm run dev
# App runs at http://localhost:3000
```

---

## Complete Setup Guide

### Prerequisites
- Docker + Docker Compose
- Node.js 18+
- Gemini API key (free tier available at https://aistudio.google.com)

### Architecture
```
┌─────────────────────────────────────┐
│  PMS Frontend (3000)                │
│  - Executive Dashboard              │
│  - CEO Agent Drawer                 │
└─────────────┬───────────────────────┘
              │
              ├──────────────────────────┐
              │                          │
    http://localhost:8081  http://localhost:8080
         │                       │
    ┌────▼──────┐         ┌──────▼─────┐
    │ CEO Agent │         │ Cognee API │
    │ (8081)    │         │  (8080)    │
    └────┬──────┘         └──────┬─────┘
         │                       │
         └───────┬───────────────┘
                 │
        ┌────────┴──────────┬──────────────┐
        │                   │              │
    PostgreSQL         Redis Stack     LiteLLM
    (5432)            (6379)          (8000)
```

---

## Manual Startup (if not using docker-compose)

### 1. PostgreSQL with pgvector
```bash
docker run -d \
  --name cognee_postgres \
  -e POSTGRES_USER=cognee_user \
  -e POSTGRES_PASSWORD=cognee_password_dev \
  -e POSTGRES_DB=cognee_db \
  -p 5432:5432 \
  pgvector/pgvector:pg16-latest
```

### 2. Redis Stack
```bash
docker run -d \
  --name cognee_redis \
  -e REDIS_PASSWORD=redis_password_dev \
  -p 6379:6379 \
  redis/redis-stack:latest \
  redis-server --requirepass redis_password_dev
```

### 3. Cognee API
```bash
cd infra/docker/cognee
docker build -t cognee:latest .
docker run -d \
  --name cognee_api \
  -p 8080:8000 \
  --env-file .env \
  cognee:latest
```

### 4. CEO Agent
```bash
cd agents/ceo-visibility
docker build -t ceo-agent:latest .
docker run -d \
  --name ceo_agent \
  -p 8081:8000 \
  --env-file .env \
  ceo-agent:latest
```

---

## Testing

### 1. Test Cognee API
```bash
curl -X POST http://localhost:8080/add \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "title": "Test Document",
    "content": "This is a test document for the Cognee API"
  }'
```

### 2. Test CEO Agent
```bash
curl -X POST http://localhost:8081/agui \
  -H "Authorization: Bearer test-token" \
  -H "X-Company-Id: test-company" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [],
    "userMessage": "How is my organization performing?"
  }'
```

### 3. Test PMS Frontend
```bash
# Navigate to http://localhost:3000
# Login with test account
# Go to Executive Dashboard
# Click "Ask AI" button
# Type a question
```

---

## Environment Variables

### Cognee (.env)
```env
COGNEE_DB_HOST=postgres
COGNEE_DB_PORT=5432
COGNEE_DB_NAME=cognee_db
COGNEE_DB_USER=cognee_user
COGNEE_DB_PASSWORD=cognee_password_dev
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_dev
LITELLM_URL=http://litellm:8000
LITELLM_API_KEY=sk-litellm-dev-key
```

### CEO Agent (.env)
```env
COGNEE_API_URL=http://cognee:8000
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_dev
DATABASE_URL=postgresql://cognee_user:cognee_password_dev@postgres:5432/agent_db
GEMINI_API_KEY=your-actual-key
```

### PMS Frontend (.env.local)
```env
NEXT_PUBLIC_CEO_AGENT_URL=http://localhost:8081
```

---

## Troubleshooting

### "Connection refused" on port 8080/8081
```bash
# Check if services are running
docker ps

# View logs
docker logs cognee_api
docker logs ceo_agent
```

### "Database connection failed"
```bash
# Ensure PostgreSQL is ready
docker logs cognee_postgres

# Wait 10 seconds and retry (first startup takes time)
```

### "Redis connection failed"
```bash
# Check Redis is running
redis-cli -h localhost -p 6379 -a redis_password_dev PING

# Should respond: PONG
```

### Agent responds but no tool results
1. Check Cognee API is reachable: `curl http://localhost:8080/health`
2. Check Firestore permissions (Firebase JWT must be valid)
3. Check agent logs: `docker logs ceo_agent`

---

## Cleanup

### Stop all services
```bash
docker-compose down
```

### Remove volumes (reset database)
```bash
docker-compose down -v
```

### Remove all docker artifacts
```bash
docker system prune -a
```

---

## Next Steps

1. ✅ `.env` files created for local development
2. ✅ `docker-compose.yml` configured
3. ✅ LiteLLM routing configured
4. 📋 **TODO**: Run `docker-compose up -d` to start services
5. 📋 **TODO**: Test agent from PMS dashboard
6. 📋 **TODO**: Deploy to Cloud Run for production

---

**Ready to start local development?** Run:
```bash
cd infra/docker && docker-compose up -d
```
