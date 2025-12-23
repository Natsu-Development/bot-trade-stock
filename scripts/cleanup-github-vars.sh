#!/bin/bash
# Script to remove all GitHub repository variables (not secrets)
# This script removes variables that have been moved to config/production.env
#
# Usage:
#   ./scripts/cleanup-github-vars.sh [--dry-run]
#   ./scripts/cleanup-github-vars.sh REPO_OWNER REPO_NAME GIT_TOKEN [ENVIRONMENT] [--dry-run]
#
# Options:
#   --dry-run    Show what would be deleted without actually deleting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧹 GitHub Variables Cleanup Script"
echo "==================================="
echo ""

# Check for dry-run flag
DRY_RUN=false
for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        DRY_RUN=true
        echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
        echo ""
    fi
done

# Get GitHub repository information from git remote
if git remote -v | grep -q github.com; then
    GITHUB_REMOTE=$(git remote get-url origin)
    if [[ "$GITHUB_REMOTE" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
        DEFAULT_OWNER="${BASH_REMATCH[1]}"
        DEFAULT_REPO="${BASH_REMATCH[2]}"
    fi
fi

# Get parameters from command line or prompt user
REPO_OWNER="$1"
REPO_NAME="$2"
GIT_TOKEN="$3"
ENVIRONMENT="${4:-production}"

# Filter out --dry-run from positional params
[[ "$REPO_OWNER" == "--dry-run" ]] && REPO_OWNER=""
[[ "$REPO_NAME" == "--dry-run" ]] && REPO_NAME=""
[[ "$GIT_TOKEN" == "--dry-run" ]] && GIT_TOKEN=""
[[ "$ENVIRONMENT" == "--dry-run" ]] && ENVIRONMENT="production"

# If not provided via command line, prompt user
if [ -z "$REPO_OWNER" ]; then
    read -p "🏠 GitHub username/organization [$DEFAULT_OWNER]: " REPO_OWNER
    REPO_OWNER=${REPO_OWNER:-$DEFAULT_OWNER}
fi

if [ -z "$REPO_NAME" ]; then
    read -p "📦 Repository name [$DEFAULT_REPO]: " REPO_NAME
    REPO_NAME=${REPO_NAME:-$DEFAULT_REPO}
fi

if [ -z "$GIT_TOKEN" ]; then
    echo ""
    echo "🔑 You need a GitHub Personal Access Token."
    echo ""
    echo "📝 Option 1: Classic Token (simpler)"
    echo "   https://github.com/settings/tokens/new"
    echo "   - Select 'repo' scope"
    echo ""
    echo "📝 Option 2: Fine-grained Token"
    echo "   https://github.com/settings/personal-access-tokens/new"
    echo "   - Repository permissions needed:"
    echo "     • Variables: Read and write"
    echo "     • Environments: Read and write"
    echo ""
    read -s -p "🔐 GitHub Personal Access Token: " GIT_TOKEN
    echo ""
fi

# Validate required parameters
if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ] || [ -z "$GIT_TOKEN" ]; then
    echo -e "${RED}❌ Error: All fields are required${NC}"
    echo "Usage: $0 [REPO_OWNER] [REPO_NAME] [GIT_TOKEN] [ENVIRONMENT] [--dry-run]"
    exit 1
fi

echo ""
echo "📋 Configuration:"
echo "   Repository: $REPO_OWNER/$REPO_NAME"
echo "   Environment: $ENVIRONMENT"
echo "   Token: ${GIT_TOKEN:0:8}..."
echo ""

# Variables that should be removed (moved to config/production.env)
VARS_TO_REMOVE=(
    # Docker (now in production.env)
    "DOCKER_REGISTRY"
    "DOCKER_NAMESPACE"
    
    # System
    "NODE_ENV"
    
    # Server
    "GRPC_SERVER_ADDR"
    "HTTP_PORT"
    
    # HTTP Timeouts
    "HTTP_READ_TIMEOUT"
    "HTTP_WRITE_TIMEOUT"
    "HTTP_IDLE_TIMEOUT"
    "HTTP_SHUTDOWN_TIMEOUT"
    
    # gRPC Timeouts
    "GRPC_CONNECTION_TIMEOUT"
    "GRPC_REQUEST_TIMEOUT"
    "GRPC_MARKET_DATA_TIMEOUT"
    
    # MongoDB
    "MONGODB_DATABASE"
    
    # Bearish Cron
    "BEARISH_CRON_AUTO_START"
    "BEARISH_CRON_START_DATE_OFFSET"
    "BEARISH_30M_ENABLED"
    "BEARISH_30M_SCHEDULE"
    "BEARISH_1H_ENABLED"
    "BEARISH_1H_SCHEDULE"
    "BEARISH_1D_ENABLED"
    "BEARISH_1D_SCHEDULE"
    "BEARISH_1W_ENABLED"
    "BEARISH_1W_SCHEDULE"
    
    # Bullish Cron
    "BULLISH_CRON_AUTO_START"
    "BULLISH_CRON_START_DATE_OFFSET"
    "BULLISH_30M_ENABLED"
    "BULLISH_30M_SCHEDULE"
    "BULLISH_1H_ENABLED"
    "BULLISH_1H_SCHEDULE"
    "BULLISH_1D_ENABLED"
    "BULLISH_1D_SCHEDULE"
    "BULLISH_1W_ENABLED"
    "BULLISH_1W_SCHEDULE"
    
    # Other
    "LOG_LEVEL"
    "DEFAULT_SYMBOLS"
    "TELEGRAM_ENABLED"
    
    # RSI (removed from config)
    "RSI_PERIOD"
    "RSI_OVERBOUGHT_THRESHOLD"
    "RSI_OVERSOLD_THRESHOLD"
    "RSI_EXTREME_OVERBOUGHT_THRESHOLD"
    "RSI_EXTREME_OVERSOLD_THRESHOLD"
    
    # Divergence (removed from config)
    "DIVERGENCE_LOOKBACK_LEFT"
    "DIVERGENCE_LOOKBACK_RIGHT"
    "DIVERGENCE_RANGE_MIN"
    "DIVERGENCE_RANGE_MAX"
    "DIVERGENCE_INDICES_RECENT"
    
    # Business Rules (removed from config)
    "MIN_ANALYSIS_DAYS"
    "MAX_DATE_RANGE_DAYS"
    "MIN_SYMBOL_LENGTH"
    "MAX_SYMBOL_LENGTH"
    "CRON_JOB_TIMEOUT"
)

# Function to delete repository-level variable
delete_repo_variable() {
    local name="$1"
    
    if $DRY_RUN; then
        echo -e "  ${YELLOW}[DRY RUN] Would delete repo variable: $name${NC}"
        return 0
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X DELETE \
        -H "Authorization: Bearer $GIT_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/variables/$name")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" -eq 204 ]; then
        echo -e "  ${GREEN}✅ Deleted repo variable: $name${NC}"
        return 0
    elif [ "$http_code" -eq 404 ]; then
        return 1  # Not found
    else
        echo -e "  ${RED}❌ Failed to delete repo variable: $name (HTTP $http_code)${NC}"
        return 1
    fi
}

# Function to delete environment-level variable
delete_env_variable() {
    local name="$1"
    local env="$2"
    
    if $DRY_RUN; then
        echo -e "  ${YELLOW}[DRY RUN] Would delete env variable: $name (in $env)${NC}"
        return 0
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X DELETE \
        -H "Authorization: Bearer $GIT_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$env/variables/$name")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" -eq 204 ]; then
        echo -e "  ${GREEN}✅ Deleted env variable: $name (in $env)${NC}"
        return 0
    elif [ "$http_code" -eq 404 ]; then
        return 1  # Not found
    else
        echo -e "  ${RED}❌ Failed to delete env variable: $name (HTTP $http_code)${NC}"
        return 1
    fi
}

# Get list of existing repo variables
echo "🔍 Fetching existing repository variables..."
repo_response=$(curl -s \
    -H "Authorization: Bearer $GIT_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/variables?per_page=100")

if echo "$repo_response" | grep -q '"message".*403\|"status":"403"'; then
    echo -e "${RED}❌ Error: Token lacks 'Variables' permission${NC}"
    echo "   For fine-grained tokens, enable: Repository permissions > Variables > Read and write"
    exit 1
fi
existing_repo_vars=$(echo "$repo_response" | tr -d '\n' | grep -oP '"name"\s*:\s*"\K[^"]+' || echo "")
repo_count=$(echo "$existing_repo_vars" | wc -w)
echo "   Found $repo_count repository variables"

# Get list of existing environment variables (with pagination)
echo "🔍 Fetching existing environment variables for '$ENVIRONMENT'..."
env_response=$(curl -s \
    -H "Authorization: Bearer $GIT_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$ENVIRONMENT/variables?per_page=100")

if echo "$env_response" | grep -q '"message".*403\|"status":"403"'; then
    echo -e "${RED}❌ Error: Token lacks 'Environments' permission${NC}"
    echo "   For fine-grained tokens, enable: Repository permissions > Environments > Read and write"
    exit 1
fi
existing_env_vars=$(echo "$env_response" | tr -d '\n' | grep -oP '"name"\s*:\s*"\K[^"]+' || echo "")
env_count=$(echo "$existing_env_vars" | wc -w)
echo "   Found $env_count environment variables"

echo ""
echo "🧹 Cleaning up variables..."
echo "==========================="

deleted_repo=0
deleted_env=0
skipped=0

for var in "${VARS_TO_REMOVE[@]}"; do
    found=false
    
    # Check and delete from repository level
    if echo "$existing_repo_vars" | grep -q "^${var}$"; then
        if delete_repo_variable "$var"; then
            deleted_repo=$((deleted_repo + 1))
            found=true
        fi
    fi
    
    # Check and delete from environment level
    if echo "$existing_env_vars" | grep -q "^${var}$"; then
        if delete_env_variable "$var" "$ENVIRONMENT"; then
            deleted_env=$((deleted_env + 1))
            found=true
        fi
    fi
    
    if ! $found; then
        skipped=$((skipped + 1))
    fi
done

echo ""
echo "==========================="
echo ""

if $DRY_RUN; then
    echo -e "${YELLOW}DRY RUN complete. Run without --dry-run to delete variables.${NC}"
else
    echo -e "${GREEN}✅ Cleanup complete!${NC}"
    echo "   Deleted from repository: $deleted_repo"
    echo "   Deleted from environment: $deleted_env"
fi
echo "   Skipped (not found): $skipped"
echo ""
echo "🔒 Remaining secrets to keep:"
echo "   - DOCKER_USERNAME"
echo "   - DOCKER_PASSWORD"
echo "   - VPS_HOST"
echo "   - VPS_USER"
echo "   - VPS_SSH_KEY"
echo "   - MONGO_ROOT_USERNAME"
echo "   - MONGO_ROOT_PASSWORD"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_CHAT_ID"
echo ""
echo "📝 All config is now in: config/production.env (version controlled)"
