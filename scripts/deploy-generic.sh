#!/bin/bash
set -e

# Generic deployment script for multiple cloud providers
# Usage: ./deploy-generic.sh PROVIDER [CONFIG_FILE]

PROVIDER="$1"
CONFIG_FILE="$2"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIGS_DIR="$SCRIPT_DIR/configs"

# Default config files
if [ -z "$CONFIG_FILE" ]; then
    case "$PROVIDER" in
        "oracle"|"oci")
            CONFIG_FILE="$CONFIGS_DIR/oracle-cloud.json"
            ;;
        "aws"|"ec2")
            CONFIG_FILE="$CONFIGS_DIR/aws-ec2.json"
            ;;
        "generic"|"vps")
            CONFIG_FILE="$CONFIGS_DIR/generic-vps.json"
            ;;
        *)
            echo "❌ Unsupported provider: $PROVIDER"
            echo "💡 Supported providers: oracle, aws, generic"
            echo "   Usage: $0 PROVIDER [CONFIG_FILE]"
            exit 1
            ;;
    esac
fi

# Validate config file
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Check for required tools
if ! command -v jq >/dev/null; then
    echo "❌ jq is required but not installed"
    echo "💡 Install jq: sudo apt-get install jq (Ubuntu) or brew install jq (macOS)"
    exit 1
fi

# Load configuration
echo "🔧 Loading configuration for provider: $PROVIDER"
echo "📋 Config file: $CONFIG_FILE"

PROVIDER_NAME=$(jq -r '.name' "$CONFIG_FILE")
APP_DIR=$(jq -r '.deployment.app_directory' "$CONFIG_FILE")
DOCKER_COMPOSE_CMD=$(jq -r '.deployment.docker_compose_command' "$CONFIG_FILE")
HEALTH_TIMEOUT=$(jq -r '.deployment.health_check.timeout' "$CONFIG_FILE")
HEALTH_INTERVAL=$(jq -r '.deployment.health_check.interval' "$CONFIG_FILE")

echo "🚀 Starting deployment to $PROVIDER_NAME"

# Function to execute commands with error handling
execute_commands() {
    local commands_json="$1"
    local description="$2"
    
    if [ "$commands_json" != "null" ] && [ -n "$commands_json" ]; then
        echo "📋 Executing $description commands..."
        
        # Convert JSON array to bash commands and execute
        echo "$commands_json" | jq -r '.[]' | while read -r cmd; do
            if [ -n "$cmd" ] && [[ ! "$cmd" =~ ^[[:space:]]*# ]]; then
                echo "  ▶ $cmd"
                eval "$cmd" || {
                    echo "❌ Command failed: $cmd"
                    return 1
                }
            elif [[ "$cmd" =~ ^[[:space:]]*# ]]; then
                echo "  💬 $cmd"
            fi
        done
    else
        echo "⏭️  Skipping $description (no commands defined)"
    fi
}

# Create application directory
echo "📁 Setting up application directory..."
USER_SETUP=$(jq -r '.deployment.user_setup' "$CONFIG_FILE")
execute_commands "$USER_SETUP" "user setup"

cd "$APP_DIR" || exit 1

# Pre-deployment setup
PRE_DEPLOYMENT=$(jq -r '.deployment.pre_deployment' "$CONFIG_FILE")
execute_commands "$PRE_DEPLOYMENT" "pre-deployment setup"

# Backup existing configuration
if [ -f docker-compose.yml ]; then
    BACKUP_NAME="docker-compose.backup.$(date +%Y%m%d_%H%M%S).yml"
    echo "💾 Backing up existing configuration to $BACKUP_NAME"
    cp docker-compose.yml "$BACKUP_NAME"
fi

# Deploy new configuration  
echo "📦 Deploying new configuration..."
if [ -f /tmp/docker-compose.yml ]; then
    cp /tmp/docker-compose.yml ./docker-compose.yml
    echo "✅ Configuration deployed"
else
    echo "❌ No docker-compose.yml found in /tmp/"
    exit 1
fi

# 🔒 SECURITY: Create .env.secrets file from environment variables
echo "🔐 Setting up secrets..."
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "✅ Creating .env.secrets from environment variables..."
    cat > .env.secrets << EOF
# Secrets (injected during deployment)
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
    chmod 600 .env.secrets
    echo "✅ Secrets file created with secure permissions (600)"
elif [ -f .env.secrets ]; then
    echo "✅ Using existing .env.secrets file"
    chmod 600 .env.secrets
else
    echo "❌ ERROR: No secrets provided!"
    echo "   Secrets must be passed via environment variables:"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - TELEGRAM_CHAT_ID"
    echo ""
    echo "   Or create .env.secrets file manually in $APP_DIR"
    exit 1
fi

# Pull latest images
echo "📥 Pulling Docker images..."
$DOCKER_COMPOSE_CMD pull

# Stop existing containers gracefully
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE_CMD down --timeout 30 || true

# Start new containers
echo "🚀 Starting new containers..."
$DOCKER_COMPOSE_CMD up -d

# Health check
echo "🏥 Performing health checks..."
echo "⏱️  Timeout: ${HEALTH_TIMEOUT}s, Interval: ${HEALTH_INTERVAL}s"

elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    # Check container status
    if $DOCKER_COMPOSE_CMD ps --format="table {{.Name}}\t{{.Status}}" | grep -q "healthy"; then
        healthy_count=$($DOCKER_COMPOSE_CMD ps --format="table {{.Name}}\t{{.Status}}" | grep -c "healthy" || echo 0)
        total_services=$($DOCKER_COMPOSE_CMD ps --services | wc -l)
        
        echo "📊 Health status: $healthy_count/$total_services services healthy"
        
        if [ "$healthy_count" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
            echo "✅ All services are healthy!"
            break
        fi
    else
        echo "⏳ Waiting for services to start... ($elapsed/${HEALTH_TIMEOUT}s)"
    fi
    
    sleep $HEALTH_INTERVAL
    elapsed=$((elapsed + HEALTH_INTERVAL))
    
    # Show status every 30 seconds
    if [ $((elapsed % 30)) -eq 0 ]; then
        echo "📋 Current status:"
        $DOCKER_COMPOSE_CMD ps --format="table {{.Name}}\t{{.Status}}"
    fi
done

# Check final status
if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
    echo "❌ Health check timeout after ${HEALTH_TIMEOUT} seconds"
    echo "📋 Final container status:"
    $DOCKER_COMPOSE_CMD ps
    echo "📋 Recent container logs:"
    $DOCKER_COMPOSE_CMD logs --tail=50
    exit 1
fi

# Post-deployment commands
POST_DEPLOYMENT=$(jq -r '.deployment.post_deployment' "$CONFIG_FILE")
execute_commands "$POST_DEPLOYMENT" "post-deployment setup"

# Final status report
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Final Service Status:"
$DOCKER_COMPOSE_CMD ps --format="table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Get server IP for endpoints
if command -v curl >/dev/null && curl -s --max-time 5 http://httpbin.org/ip >/dev/null 2>&1; then
    PUBLIC_IP=$(curl -s --max-time 5 http://httpbin.org/ip | jq -r '.origin' 2>/dev/null || echo "unknown")
else
    PUBLIC_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
fi

echo ""
echo "🔗 Service Endpoints:"
echo "  - Broker gRPC: $PUBLIC_IP:50051"
echo "  - Trading Bot API: http://$PUBLIC_IP:8080"
echo "  - Health Check: http://$PUBLIC_IP:8080/health"

# Log deployment info
LOGS_DIR=$(jq -r '.monitoring.logs_directory' "$CONFIG_FILE")
if [ "$LOGS_DIR" != "null" ] && [ -n "$LOGS_DIR" ]; then
    mkdir -p "$LOGS_DIR"
    
    cat > "$LOGS_DIR/deployment-$(date +%Y%m%d_%H%M%S).log" << EOF
Deployment completed successfully
Date: $(date)
Provider: $PROVIDER_NAME
Configuration: $CONFIG_FILE
Application Directory: $APP_DIR
Docker Compose Command: $DOCKER_COMPOSE_CMD
Public IP: $PUBLIC_IP
Services: $($DOCKER_COMPOSE_CMD ps --services | tr '\n' ' ')
Images: $($DOCKER_COMPOSE_CMD ps --format="table {{.Image}}" | tail -n +2 | tr '\n' ' ')
EOF
    
    echo "📝 Deployment log saved to: $LOGS_DIR/deployment-$(date +%Y%m%d_%H%M%S).log"
fi

echo ""
echo "✨ Deployment process completed at $(date)"
