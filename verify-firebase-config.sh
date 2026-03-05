#!/bin/bash
# Firebase Storage Setup Verification Script
# Run this after updating .env files to verify all configurations

set -e

echo "🔍 Firebase Storage Configuration Verification"
echo "============================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check_env_var() {
    local var_name=$1
    local file=$2
    local required=$3
    
    if [ -f "$file" ]; then
        if grep -q "^${var_name}=" "$file"; then
            value=$(grep "^${var_name}=" "$file" | cut -d'=' -f2-)
            if [ -z "${value}" ] || [ "${value}" = "your-*" ]; then
                echo -e "${YELLOW}⚠️  ${var_name} in ${file}: PLACEHOLDER VALUE${NC}"
                FAIL=$((FAIL + 1))
            else
                echo -e "${GREEN}✅ ${var_name} in ${file}: SET${NC}"
                PASS=$((PASS + 1))
            fi
        else
            if [ "$required" = "true" ]; then
                echo -e "${RED}❌ ${var_name} in ${file}: MISSING (required)${NC}"
                FAIL=$((FAIL + 1))
            else
                echo -e "${YELLOW}⚠️  ${var_name} in ${file}: MISSING (optional)${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ File not found: ${file}${NC}"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "📋 Checking Frontend Configuration (.env.local)"
echo "---"
check_env_var "NEXT_PUBLIC_FIREBASE_PROJECT_ID" ".env.local" "true"
check_env_var "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" ".env.local" "true"
check_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" ".env.local" "true"
check_env_var "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" ".env.local" "true"

echo ""
echo "📋 Checking Backend Agent Configuration (agents/ceo-visibility/.env)"
echo "---"
check_env_var "FIREBASE_PROJECT_ID" "agents/ceo-visibility/.env" "true"
check_env_var "FIREBASE_CLIENT_EMAIL" "agents/ceo-visibility/.env" "true"
check_env_var "FIREBASE_PRIVATE_KEY" "agents/ceo-visibility/.env" "true"

echo ""
echo "📋 Checking Cognee Configuration (infra/docker/cognee/.env)"
echo "---"
check_env_var "COGNEE_DB_HOST" "infra/docker/cognee/.env" "false"
check_env_var "REDIS_HOST" "infra/docker/cognee/.env" "false"

echo ""
echo "============================================================"
echo -e "${GREEN}✅ Passed: ${PASS}${NC} | ${RED}❌ Failed: ${FAIL}${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo "⚠️  Some checks failed. Please review the FIREBASE_STORAGE_UPDATE_PLAN.md"
    exit 1
else
    echo "✅ All configuration checks passed!"
    exit 0
fi
