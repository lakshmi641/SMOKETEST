#!/bin/bash

# Helper script to run sales data cleanup with ClickHouse credentials
# This script sets environment variables and runs the sales cleanup script

set -e

# ClickHouse Configuration (GCP VM)
export CLICKHOUSE_HOST="http://35.229.46.117:8123"
export CLICKHOUSE_USERNAME="default"
export CLICKHOUSE_PASSWORD="8QQ3gV8pKBlWSQd1tZta6qkK7"
export CLICKHOUSE_DATABASE="default"

echo "🔧 Environment configured:"
echo "   CLICKHOUSE_HOST=$CLICKHOUSE_HOST"
echo "   CLICKHOUSE_USERNAME=$CLICKHOUSE_USERNAME"
echo ""

# Get the script directory and navigate to apps/pms
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

# Run the sales cleanup script
echo "🚀 Running sales data cleanup..."
echo ""
npx tsx src/scripts/cleanup-sales-data.ts

