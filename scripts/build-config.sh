#!/bin/bash
set -e

# Build final docker-compose.yml with environment variables
# Usage: ./build-config.sh TEMPLATE_FILE ENV_FILE REGISTRY IMAGE_TAG [SECRETS_ENV_FILE] [OUTPUT_FILE]

TEMPLATE_FILE="$1"
ENV_FILE="$2"
REGISTRY="$3"
IMAGE_TAG="$4"
SECRETS_ENV_FILE="${5:-}"
OUTPUT_FILE="${6:-docker-compose.yml}"

if [ -z "$TEMPLATE_FILE" ] || [ -z "$ENV_FILE" ] || [ -z "$REGISTRY" ] || [ -z "$IMAGE_TAG" ]; then
    echo "❌ Usage: $0 TEMPLATE_FILE ENV_FILE REGISTRY IMAGE_TAG [SECRETS_ENV_FILE] [OUTPUT_FILE]"
    echo "   Example: $0 docker/docker-compose.prod.yml vars.env myuser/myapp v1.0.0"
    exit 1
fi

# Validate input files
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

echo "🐳 Building docker-compose configuration"
echo "📋 Template: $TEMPLATE_FILE"
echo "🔧 Environment: $ENV_FILE"
echo "📦 Registry: $REGISTRY"
echo "🏷️  Tag: $IMAGE_TAG"

# Load environment variables
echo "📥 Loading environment variables..."

# Function to safely load env file (skip comments and empty lines)
load_env_file() {
    local env_file="$1"
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        
        # Only process valid environment variable assignments
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.* ]]; then
            export "$line"
        fi
    done < "$env_file"
}

set -a  # Automatically export all variables
load_env_file "$ENV_FILE"

# Override with registry and image tag
export DOCKER_REGISTRY="$REGISTRY"
export IMAGE_TAG="$IMAGE_TAG"

# Load secrets if provided
if [ -n "$SECRETS_ENV_FILE" ] && [ -f "$SECRETS_ENV_FILE" ]; then
    echo "🔒 Loading secrets from: $SECRETS_ENV_FILE"
    load_env_file "$SECRETS_ENV_FILE"
fi

set +a  # Stop automatically exporting variables

# Substitute environment variables in template
echo "🔄 Substituting variables in template..."
envsubst < "$TEMPLATE_FILE" > "$OUTPUT_FILE"

# Validate the generated docker-compose file
echo "🔍 Validating generated docker-compose file..."

# Check if docker-compose is available
if command -v docker-compose >/dev/null 2>&1; then
    if docker-compose -f "$OUTPUT_FILE" config >/dev/null 2>&1; then
        echo "✅ Docker-compose validation passed"
    else
        echo "❌ Docker-compose validation failed"
        echo "📋 Checking syntax..."
        docker-compose -f "$OUTPUT_FILE" config
        exit 1
    fi
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    if docker compose -f "$OUTPUT_FILE" config >/dev/null 2>&1; then
        echo "✅ Docker compose validation passed"
    else
        echo "❌ Docker compose validation failed"
        echo "📋 Checking syntax..."
        docker compose -f "$OUTPUT_FILE" config
        exit 1
    fi
else
    echo "⚠️  Docker compose not available, skipping validation"
    echo "💡 Install docker-compose to enable validation"
fi

# Basic file validation
if [ ! -s "$OUTPUT_FILE" ]; then
    echo "❌ Generated file is empty"
    exit 1
fi

if ! grep -q "version:" "$OUTPUT_FILE"; then
    echo "❌ Generated file doesn't contain docker-compose version"
    exit 1
fi

if ! grep -q "services:" "$OUTPUT_FILE"; then
    echo "❌ Generated file doesn't contain services section"
    exit 1
fi

# Count substituted variables
SUBSTITUTED_COUNT=$(grep -o '\${[^}]*}' "$TEMPLATE_FILE" | wc -l || echo 0)
REMAINING_COUNT=$(grep -o '\${[^}]*}' "$OUTPUT_FILE" | wc -l || echo 0)
PROCESSED_COUNT=$((SUBSTITUTED_COUNT - REMAINING_COUNT))

echo "✅ Configuration built successfully"
echo "📊 Variables processed: $PROCESSED_COUNT/$SUBSTITUTED_COUNT"
echo "📁 Output file: $OUTPUT_FILE"
echo "📏 File size: $(wc -c < "$OUTPUT_FILE") bytes"

if [ $REMAINING_COUNT -gt 0 ]; then
    echo "⚠️  Warning: $REMAINING_COUNT unsubstituted variables remain:"
    grep -o '\${[^}]*}' "$OUTPUT_FILE" | sort -u | head -5
    echo "💡 Make sure these variables are defined in your environment"
fi

# Show final file info
echo ""
echo "📋 Generated docker-compose.yml summary:"
echo "   Services: $(grep -c "^[[:space:]]*[a-zA-Z0-9_-]*:" "$OUTPUT_FILE" || echo 0)"
echo "   Images: $(grep -c "image:" "$OUTPUT_FILE" || echo 0)"
echo "   Environment vars: $(grep -c "environment:" "$OUTPUT_FILE" || echo 0)"
echo "   Networks: $(grep -c "networks:" "$OUTPUT_FILE" || echo 0)"
