#!/bin/bash

# Export environment variables from .env.local file
# Usage: source scripts/export-env.sh

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE file not found!"
    echo "Please create .env.local file with required environment variables"
    return 1
fi

echo "🔧 Loading environment variables from $ENV_FILE..."

# Export variables using set -a
set -a
source "$ENV_FILE"
set +a

echo "🎉 Environment variables loaded successfully!"
echo ""
echo "📋 Loaded variables:"
echo "   NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:0:50}..."
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}..."
echo "   MONGODB_DATABASE_NAME: ${MONGODB_DATABASE_NAME:-'haberdb'}"
echo "   QDRANT_URL: ${QDRANT_URL:-'localhost:6333'}" 