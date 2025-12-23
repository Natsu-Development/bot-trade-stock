#!/bin/bash
set -e

APP_DIR="/opt/trading-app"

# Setup directory and backup
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -f docker-compose.yml ]; then
    cp docker-compose.yml "docker-compose.backup.$(date +%Y%m%d_%H%M%S).yml"
fi

# Copy configuration files
cp /tmp/docker-compose.yml ./docker-compose.yml
cp /tmp/.env.production ./.env.production

# Validate required secrets
validate_secrets() {
    local missing=()
    [ -z "$MONGO_ROOT_USERNAME" ] && missing+=("MONGO_ROOT_USERNAME")
    [ -z "$MONGO_ROOT_PASSWORD" ] && missing+=("MONGO_ROOT_PASSWORD")
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo "Error: Missing required secrets: ${missing[*]}"
        return 1
    fi
    return 0
}

# Create secrets file
if validate_secrets; then
    cat > .env.secrets << EOF
MONGO_ROOT_USERNAME=$MONGO_ROOT_USERNAME
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
MONGODB_URI=mongodb://$MONGO_ROOT_USERNAME:$MONGO_ROOT_PASSWORD@mongo:27017/bot_trade?authSource=admin
EOF
    chmod 600 .env.secrets
elif [ ! -f .env.secrets ]; then
    echo "Error: No secrets provided and no existing .env.secrets file!"
    exit 1
else
    echo "Warning: Using existing .env.secrets file"
fi

# Deploy containers
docker-compose pull
docker-compose down --timeout 30 || true
docker-compose up -d

# Wait for services
sleep 10
docker-compose ps

echo "Deployment complete!"
