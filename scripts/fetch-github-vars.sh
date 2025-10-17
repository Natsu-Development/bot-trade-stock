#!/bin/bash
set -e

# Fetch GitHub repository variables and create environment file
# Usage: ./fetch-github-vars.sh REPO_OWNER REPO_NAME GIT_TOKEN [OUTPUT_FILE]

REPO_OWNER="$1"
REPO_NAME="$2" 
GIT_TOKEN="$3"
OUTPUT_FILE="${4:-github-vars.env}"

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ] || [ -z "$GIT_TOKEN" ]; then
    echo "❌ Usage: $0 REPO_OWNER REPO_NAME GIT_TOKEN [OUTPUT_FILE]"
    echo "   Example: $0 myuser trading-app ghp_xxxxx"
    exit 1
fi

echo "🔍 Fetching GitHub variables for $REPO_OWNER/$REPO_NAME"

# Fetch repository variables
VARS_JSON=$(curl -s -H "Authorization: token $GIT_TOKEN" \
                 -H "Accept: application/vnd.github.v3+json" \
                 "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/variables")

# Check if API call was successful
if echo "$VARS_JSON" | jq -e .message >/dev/null 2>&1; then
    ERROR_MSG=$(echo "$VARS_JSON" | jq -r .message)
    echo "❌ GitHub API Error: $ERROR_MSG"
    
    if [[ "$ERROR_MSG" == *"Not Found"* ]]; then
        echo "💡 Make sure the repository exists and the token has correct permissions"
    elif [[ "$ERROR_MSG" == *"rate limit"* ]]; then
        echo "💡 GitHub API rate limit exceeded. Wait a few minutes and try again"
    fi
    exit 1
fi

# Create environment file with GitHub variables
echo "# GitHub Repository Variables" > "$OUTPUT_FILE"
echo "# Generated on: $(date)" >> "$OUTPUT_FILE"
echo "# Repository: $REPO_OWNER/$REPO_NAME" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract and add each variable
VARS_COUNT=$(echo "$VARS_JSON" | jq '.variables | length')
if [ "$VARS_COUNT" -gt 0 ]; then
    # Write variables and validate each line
    while IFS= read -r var_line; do
        # Only write lines that look like valid environment variables (NAME=VALUE)
        if [[ "$var_line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.* ]]; then
            echo "$var_line" >> "$OUTPUT_FILE"
        else
            echo "⚠️  Skipping invalid variable: $var_line"
        fi
    done < <(echo "$VARS_JSON" | jq -r '.variables[] | "\(.name)=\(.value)"')
    echo "📋 Found $VARS_COUNT GitHub variables"
else
    echo "⚠️  No GitHub variables found"
fi

# Add critical defaults with fallback values
echo "" >> "$OUTPUT_FILE"
echo "# Default values (overridden by GitHub variables above)" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
NODE_ENV=production
GRPC_SERVER_ADDR=broker:50051
HTTP_PORT=8080
HTTP_READ_TIMEOUT=30
HTTP_WRITE_TIMEOUT=30
HTTP_IDLE_TIMEOUT=60
HTTP_SHUTDOWN_TIMEOUT=10
GRPC_CONNECTION_TIMEOUT=5
GRPC_REQUEST_TIMEOUT=10
GRPC_MARKET_DATA_TIMEOUT=10
RSI_PERIOD=14
RSI_OVERBOUGHT_THRESHOLD=70
RSI_OVERSOLD_THRESHOLD=30
RSI_EXTREME_OVERBOUGHT_THRESHOLD=80
RSI_EXTREME_OVERSOLD_THRESHOLD=20
DIVERGENCE_LOOKBACK_LEFT=5
DIVERGENCE_LOOKBACK_RIGHT=5
DIVERGENCE_RANGE_MIN=5
DIVERGENCE_RANGE_MAX=60
DIVERGENCE_INDICES_RECENT=100
MIN_ANALYSIS_DAYS=14
MAX_DATE_RANGE_DAYS=365
MIN_SYMBOL_LENGTH=1
MAX_SYMBOL_LENGTH=10
CRON_JOB_TIMEOUT=10
BEARISH_CRON_START_DATE_OFFSET=200
BEARISH_CRON_AUTO_START=true
BEARISH_30M_ENABLED=false
BEARISH_30M_SCHEDULE=5,35 * * * *
BEARISH_1H_ENABLED=false
BEARISH_1H_SCHEDULE=0 */1 * * *
BEARISH_1D_ENABLED=true
BEARISH_1D_SCHEDULE=0 9 * * 1-5
BEARISH_1W_ENABLED=false
BEARISH_1W_SCHEDULE=0 9 * * 1
BULLISH_CRON_START_DATE_OFFSET=200
BULLISH_CRON_AUTO_START=true
BULLISH_30M_ENABLED=false
BULLISH_30M_SCHEDULE=10,40 * * * *
BULLISH_1H_ENABLED=false
BULLISH_1H_SCHEDULE=0 */1 * * *
BULLISH_1D_ENABLED=true
BULLISH_1D_SCHEDULE=0 10 * * 1-5
BULLISH_1W_ENABLED=false
BULLISH_1W_SCHEDULE=0 10 * * 1
DEFAULT_SYMBOLS=VIC,VCB,BID,CTG,TCB,VHM,HPG,VRE,MSN,NVL,SAB,VJC,GAS,PLX,VNM,MWG,FPT,POW,KDH,REE
LOG_LEVEL=info
TELEGRAM_ENABLED=false
EOF

echo "✅ Environment file created: $OUTPUT_FILE"
echo "📊 Total lines: $(wc -l < "$OUTPUT_FILE")"

# Validate the environment file
if grep -q "=" "$OUTPUT_FILE"; then
    echo "✅ Environment file validation passed"
else
    echo "❌ Environment file validation failed"
    exit 1
fi
