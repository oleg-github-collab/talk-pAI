#!/bin/bash

# Ultra-reliable startup script for Railway
echo "🚀 Talk pAI Railway Startup Script"
echo "📋 Environment: $NODE_ENV"
echo "📋 Port: $PORT"
echo "📋 Process ID: $$"

# Set defaults if missing
export PORT=${PORT:-8080}
export NODE_ENV=${NODE_ENV:-production}

echo "✅ Starting Node.js server..."
exec node server.js