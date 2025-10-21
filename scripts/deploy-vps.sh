#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Simple VPS Deployment Script
# ═══════════════════════════════════════════════════════════════════
# No config files, no Docker installation - just deploy!
# Assumes Docker is already installed on VPS

set -e  # Exit on error

APP_DIR="/opt/trading-app"

echo "════════════════════════════════════════════════════"
echo "🚀 Deploying Trading App to VPS"
echo "════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 1: Create app directory if needed
# ═══════════════════════════════════════════════════════════════════
echo "[1/6] Setting up directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR" || exit 1
echo "✓ Directory: $APP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 2: Backup existing configuration
# ═══════════════════════════════════════════════════════════════════
echo "[2/6] Backing up current configuration..."
if [ -f docker-compose.yml ]; then
    BACKUP_NAME="docker-compose.backup.$(date +%Y%m%d_%H%M%S).yml"
    cp docker-compose.yml "$BACKUP_NAME"
    echo "✓ Backup: $BACKUP_NAME"
else
    echo "⏭️  No existing configuration to backup"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 3: Copy new configuration
# ═══════════════════════════════════════════════════════════════════
echo "[3/6] Deploying new configuration..."
if [ -f /tmp/docker-compose.yml ]; then
    cp /tmp/docker-compose.yml ./docker-compose.yml
    echo "✓ Configuration deployed"
else
    echo "❌ Error: docker-compose.yml not found in /tmp/"
    exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 4: Create secrets file
# ═══════════════════════════════════════════════════════════════════
echo "[4/6] Setting up secrets..."
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    cat > .env.secrets << EOF
# Secrets (injected during deployment)
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
    chmod 600 .env.secrets
    echo "✓ Secrets file created"
elif [ -f .env.secrets ]; then
    echo "✓ Using existing secrets file"
else
    echo "❌ Error: No secrets provided!"
    exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 5: Deploy containers
# ═══════════════════════════════════════════════════════════════════
echo "[5/6] Deploying containers..."

# Pull latest images
echo "📥 Pulling Docker images..."
docker-compose pull

# Stop old containers
echo "🛑 Stopping old containers..."
docker-compose down --timeout 30 || true

# Start new containers
echo "🚀 Starting new containers..."
docker-compose up -d

echo "✓ Containers started"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 6: Health check
# ═══════════════════════════════════════════════════════════════════
echo "[6/6] Running health checks..."

TIMEOUT=120
INTERVAL=5
elapsed=0

while [ $elapsed -lt $TIMEOUT ]; do
    if docker-compose ps | grep -q "healthy"; then
        healthy_count=$(docker-compose ps | grep -c "healthy" || echo 0)
        total_services=$(docker-compose ps --services | wc -l)
        
        echo "📊 Health: $healthy_count/$total_services services healthy"
        
        if [ "$healthy_count" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
            echo "✅ All services healthy!"
            break
        fi
    else
        echo "⏳ Waiting for services... ($elapsed/${TIMEOUT}s)"
    fi
    
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
done

if [ $elapsed -ge $TIMEOUT ]; then
    echo "⚠️  Health check timeout (services may still be starting)"
    echo "📋 Container status:"
    docker-compose ps
fi
echo ""

# ═══════════════════════════════════════════════════════════════════
# Done!
# ═══════════════════════════════════════════════════════════════════
echo "════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════════════════"
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""
echo "🔗 Endpoints:"
echo "  - API: http://$(hostname -I | awk '{print $1}'):8080"
echo "  - Health: http://$(hostname -I | awk '{print $1}'):8080/health"
echo ""

# Save deployment log
mkdir -p logs
cat > logs/deployment-$(date +%Y%m%d_%H%M%S).log << EOF
Deployment completed successfully
Date: $(date)
Images: $(docker-compose ps --format="{{.Image}}" | tr '\n' ' ')
EOF

echo "✨ Ready!"

