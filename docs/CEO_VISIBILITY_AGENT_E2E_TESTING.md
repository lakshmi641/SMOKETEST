# CEO Visibility Agent - E2E Testing Guide

**Purpose**: Verify full stack integration and data flows  
**Duration**: 2-3 hours for complete testing  
**Prerequisites**: Local dev environment with all services running

---

## Pre-Test Setup

### 1. Start All Services

**Terminal 1 - Cognee API**
```bash
cd infra/docker/cognee
python server.py
# Should show: INFO:     Application startup complete [uvicorn running on 0.0.0.0:8000]
```

**Terminal 2 - CEO Agent**
```bash
cd agents/ceo-visibility
uvicorn src.main:app --reload
# Should show: INFO:     Application startup complete [uvicorn running on 0.0.0.0:8080]
```

**Terminal 3 - PMS Frontend**
```bash
cd apps/pms
npm run dev
# Should show: ▲ Next.js ... ready - started server on 0.0.0.0:3000
```

### 2. Verify Environment Variables

**PMS App (.env.local)**
```bash
NEXT_PUBLIC_CEO_AGENT_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-platform-dev
```

**CEO Agent (.env)**
```bash
FIREBASE_PROJECT_ID=julley-platform-dev
LITELLM_URL=https://litellm-proxy-...
COGNEE_API_URL=http://localhost:8000
```

**Cognee (.env)**
```bash
COGNEE_DB_HOST=10.9.0.3  # or localhost if local
REDIS_HOST=localhost  # or redis-stack.agentic.svc.cluster.local if k8s
```

---

## Test Suite

### Test 1: Service Health Checks

**1.1 Cognee API Health**
```bash
curl -s http://localhost:8000/health | jq .
# Expected: { "status": "ok", "service": "cognee-api", "version": "1.0.0" }
```

**1.2 CEO Agent Health**
```bash
curl -s http://localhost:8080/health | jq .
# Expected: { "status": "ok", "service": "ceo-visibility-agent", "version": "1.0.0" }
```

**1.3 Frontend Loads**
```bash
curl -s http://localhost:3000 | grep -o "<title>.*</title>"
# Expected: Should return a title tag
```

✅ **Pass Criteria**: All services respond with 200 OK

---

### Test 2: Authentication

**2.1 Firebase JWT Generation**

In PMS browser console:
```javascript
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
console.log(token);
```

Copy token for manual API testing.

**2.2 Token Validation**

```bash
TOKEN="<paste_token_from_above>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: test-company" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}'
# Expected: Should NOT return 401 - token accepted
```

✅ **Pass Criteria**: Auth header processed without 401/403 errors

---

### Test 3: Firestore Data Access

**3.1 Tool Call - Strategic Health**

In PMS app, open browser console:
```javascript
// This will be called via agent tool
```

Using curl:
```bash
TOKEN="<paste_token>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user", 
      "content": "How is our organization performing?"
    }]
  }' | head -100
# Expected: Streaming SSE response with tool calls
```

**3.2 Verify Firestore Collections Exist**

In Firebase Console:
- Navigate to Firestore
- Check `companies/{julley-inc}/generatedTasks`
- Check `companies/{julley-inc}/projects`
- Check `companies/{julley-inc}/users`

✅ **Pass Criteria**: 
- Firestore collections have data
- Agent receives tool results without timeout
- No access denied errors

---

### Test 4: Knowledge Base (Cognee)

**4.1 Add Document**

```bash
curl -X POST http://localhost:8000/api/v1/add \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "content": "Q4 Safety Report: Key protocols include evacuation procedures and equipment maintenance. All staff must complete annual safety certification.",
    "document_name": "Q4-Safety-Report.pdf",
    "document_type": "pdf",
    "metadata": {"category": "safety", "year": 2024}
  }'
# Expected: { "status": "success", "document_id": "...", "dataset": "tenant_test-company" }
```

**4.2 Cognify (Process) Dataset**

```bash
curl -X POST http://localhost:8000/api/v1/cognify \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "chunk_size": 2000,
    "overlap": 200
  }'
# Expected: { "status": "success", "chunks_created": ..., "embeddings_generated": ... }
```

**4.3 Search Knowledge**

```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "test-company",
    "query": "What are the safety protocols?",
    "limit": 3
  }'
# Expected: { "query": "...", "results": [...], "total": >0 }
```

**4.4 Agent Knowledge Search**

In agent request:
```bash
TOKEN="<paste_token>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: test-company" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "What does our safety report say about protocols?"
    }]
  }'
# Expected: Agent calls search_knowledge, returns quoted results
```

✅ **Pass Criteria**:
- Document added to Cognee with UUID
- Cognify completes without error
- Search returns relevant results with scores
- Agent integrates Cognee knowledge in responses

---

### Test 5: Stream & SSE Response

**5.1 SSE Streaming**

```bash
TOKEN="<paste_token>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Give me portfolio status"
    }]
  }' -v
# Expected:
# - HTTP 200 with Content-Type: text/event-stream
# - data: {chunks streaming}
# - data: [DONE]
```

**5.2 Frontend SSE Rendering**

1. Open PMS app in browser: http://localhost:3000
2. Navigate to `/ceo-agent` (or open CEO Agent drawer)
3. Type: "How is portfolio health?"
4. Should see:
   - Message sent (right-side blue bubble)
   - Agent thinking (loading indicator)
   - Response streaming in real-time (left-side gray bubble)
   - Tool results as KPI cards

✅ **Pass Criteria**:
- Response streams without buffering
- Tool calls display with formatted KPI cards
- No UI freezing or errors

---

### Test 6: Tenant Isolation

**6.1 Cross-Tenant Access Prevention**

```bash
# Create test data in different tenant
curl -X POST http://localhost:8000/api/v1/add \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "competitor-inc",
    "content": "Secret competitor data",
    "document_name": "secret.pdf"
  }'
# Returns: dataset = tenant_competitor-inc

# Try to access from different tenant
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "attacker-inc",
    "query": "Secret"
  }'
# Expected: Returns empty results (wrong dataset)

# Verify knowledge search by correct tenant
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "competitor-inc",
    "query": "Secret"
  }'
# Expected: Returns the secret document
```

**6.2 Firestore Tenant Scoping**

Agent tools inject `company_id` at function boundary. Verify in agent logs:
```
request from user@example.com: How is our health?
Agent created with company_id=julley-inc
Firestore query: companies/julley-inc/generatedTasks
```

✅ **Pass Criteria**:
- Different company_id cannot access other's Cognee data
- Firestore queries only return scoped company data
- No cross-tenant data leakage

---

### Test 7: Performance & Load

**7.1 Tool Execution Time**

Send request and measure response time:
```bash
time curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Portfolio status"}]}'
# Expected: Response within 5-10 seconds
```

**7.2 Concurrent Requests**

```bash
# Send 5 concurrent requests
for i in {1..5}; do
  curl -X POST http://localhost:8080/agui \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Company-Id: julley-inc" \
    -H "Content-Type: application/json" \
    -d "{\"messages\": [{\"role\": \"user\", \"content\": \"Request $i\"}]}" &
done
wait
# Expected: All complete without timeout or error
```

✅ **Pass Criteria**:
- Single request completes in <10s
- Concurrent requests don't interfere
- No memory leaks (check memory usage after several requests)

---

### Test 8: Error Handling

**8.1 Missing Authorization**

```bash
curl -X POST http://localhost:8080/agui \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{"messages": [...]}'
# Expected: 400 Bad Request - Missing Authorization
```

**8.2 Invalid Token**

```bash
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer invalid-token-xyz" \
  -H "X-Company-Id: julley-inc" \
  -H "Content-Type: application/json" \
  -d '{"messages": [...]}'
# Expected: 401 Unauthorized
```

**8.3 Missing Company ID**

```bash
TOKEN="<valid_token>"
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages": [...]}'
# Expected: 400 Bad Request - Missing X-Company-Id
```

**8.4 Cognee API Down**

Stop Cognee API service, then:
```bash
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Company-Id: julley-inc" \
  -d '{"messages": [{"role": "user", "content": "Search knowledge"}]}'
# Expected: Agent returns graceful error (not 500)
```

✅ **Pass Criteria**:
- Proper HTTP status codes returned
- Error messages are informative
- Service degradation doesn't crash agent

---

## Test Results Template

```markdown
# CEO Visibility Agent - Test Results
Date: ___________
Tester: ___________
Environment: [Local / Staging / Production]

## Test 1: Service Health
- [ ] Cognee API health check passes
- [ ] CEO Agent health check passes
- [ ] Frontend loads successfully

Notes: ___________

## Test 2: Authentication
- [ ] Firebase token generated successfully
- [ ] Token validation works
- [ ] Invalid token returns 401

Notes: ___________

## Test 3: Firestore Data Access
- [ ] Strategic health tool returns data
- [ ] Portfolio status tool returns data
- [ ] No access denied errors

Notes: ___________

## Test 4: Knowledge Base
- [ ] Document added to Cognee
- [ ] Cognify processes successfully
- [ ] Search returns relevant results
- [ ] Agent integrates knowledge in response

Notes: ___________

## Test 5: Streaming
- [ ] SSE response streams correctly
- [ ] Frontend displays streaming messages
- [ ] KPI cards render properly

Notes: ___________

## Test 6: Tenant Isolation
- [ ] Cross-tenant access blocked
- [ ] Firestore queries correctly scoped
- [ ] No data leakage

Notes: ___________

## Test 7: Performance
- [ ] Single request completes in <10s
- [ ] Concurrent requests work
- [ ] No memory leaks

Notes: ___________

## Test 8: Error Handling
- [ ] Missing auth returns 400
- [ ] Invalid token returns 401
- [ ] Service degradation handled

Notes: ___________

## Overall Result
- [ ] PASS - All tests successful
- [ ] PASS WITH NOTES - Some minor issues
- [ ] FAIL - Critical issues found

Critical Issues:
___________

Next Steps:
___________
```

---

## Deployment Checklist

Once all E2E tests pass locally, proceed to deployment:

### Pre-Deployment

- [ ] All tests pass locally
- [ ] Code reviewed
- [ ] Security audit completed
- [ ] Dependencies pinned in pyproject.toml
- [ ] Environment variables documented

### GCP Infrastructure

- [ ] Service accounts created (cognee-api-sa, ceo-agent-sa)
- [ ] IAM roles assigned
- [ ] Secrets created in Secret Manager
- [ ] VPC connector configured
- [ ] Cloud SQL backups enabled

### Build & Deploy

- [ ] Docker images build without errors
- [ ] Images scanned for vulnerabilities
- [ ] Images pushed to Artifact Registry
- [ ] Cloud Run services deployed
- [ ] Health checks passing on production

### Post-Deployment

- [ ] Frontend updated with production URLs
- [ ] E2E tests run against production
- [ ] Monitoring dashboards created
- [ ] Alerting configured
- [ ] Documentation updated

---

## Troubleshooting Guide

### Issue: Cognee API won't start
**Symptoms**: Port in use or import errors  
**Solution**:
```bash
# Check if port 8000 is in use
lsof -i :8000
# Stop Cognee and try again
python server.py --port 8001  # Alternative port
```

### Issue: Agent timeout
**Symptoms**: Requests hang for >30s  
**Solution**:
- Check Firestore network latency
- Verify Redis connection
- Increase AGENT_TIMEOUT in .env

### Issue: No tool results
**Symptoms**: Agent responds but tools don't execute  
**Solution**:
```bash
# Enable verbose logging
LOG_LEVEL=DEBUG uvicorn src.main:app --reload
# Check logs for tool execution errors
```

### Issue: Knowledge search returns nothing
**Symptoms**: Documents added but search empty  
**Solution**:
- Verify cognify() completed successfully
- Check dataset name includes tenant prefix
- Verify pgvector extension installed in PostgreSQL

### Issue: SSE streaming stops
**Symptoms**: Response stops mid-stream  
**Solution**:
- Check for connection timeouts (increase timeout)
- Verify LiteLLM proxy is responding
- Check browser console for errors

---

## Success Criteria

All tests pass when:
1. ✅ All 8 test suites pass
2. ✅ No data leakage between tenants
3. ✅ Response time <10s for typical queries
4. ✅ Concurrent requests don't interfere
5. ✅ Proper error handling for edge cases
6. ✅ SSE streaming smooth and responsive
7. ✅ Tool results format correctly as KPI cards
8. ✅ Frontend UX is smooth and intuitive

---

**Ready to move to production deployment** when all above criteria met.
