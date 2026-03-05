#!/bin/bash

# Helper script to run pipeline cleanup with ClickHouse credentials
# This script sets environment variables and runs the cleanup script

set -e

# ClickHouse Configuration (GCP VM)
export CLICKHOUSE_HOST="http://35.229.46.117:8123"
export CLICKHOUSE_USERNAME="default"
export CLICKHOUSE_PASSWORD="8QQ3gV8pKBlWSQd1tZta6qkK7"
export CLICKHOUSE_DATABASE="default"

# GCP Storage Configuration (use existing env or default)
export GCS_BUCKET_NAME="${GCS_BUCKET_NAME:-julley-pms-dev}"

# GCP Authentication (use existing env or default)
# If GOOGLE_APPLICATION_CREDENTIALS is not set, it will use Application Default Credentials
# Make sure you've run: gcloud auth application-default login

echo "🔧 Environment configured:"
echo "   CLICKHOUSE_HOST=$CLICKHOUSE_HOST"
echo "   CLICKHOUSE_USERNAME=$CLICKHOUSE_USERNAME"
echo "   GCS_BUCKET_NAME=$GCS_BUCKET_NAME"
echo ""

# Get the script directory and navigate to apps/pms
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

# Run the cleanup script
echo "🚀 Running pipeline cleanup..."
echo ""
npx tsx src/scripts/cleanup-pipeline-data.ts

