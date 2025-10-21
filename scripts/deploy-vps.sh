#!/bin/bash
set -e

APP_DIR="/opt/trading-app"

# Setup directory and backup
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -f docker-compose.yml ]; then
    cp docker-compose.yml "docker-compose.backup.$(date +%Y%m%d_%H%M%S).yml"
fi

# Copy new configuration
cp /tmp/docker-compose.yml ./docker-compose.yml

# Create secrets file
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    cat > .env.secrets << EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
    chmod 600 .env.secrets
elif [ ! -f .env.secrets ]; then
    echo "Error: No secrets provided!"
    exit 1
fi

# Deploy containers
docker-compose pull
docker-compose down --timeout 30 || true
docker-compose up -d

# Wait for services
sleep 10
docker-compose ps

echo "✅ Deployment complete!"

