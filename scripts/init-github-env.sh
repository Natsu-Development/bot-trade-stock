#!/bin/bash
set -e

# GitHub Environment Variables Setup Script
# This script creates GitHub environment variables from your env.example file
# Usage: ./setup-github-env.sh [REPO_OWNER] [REPO_NAME] [GIT_TOKEN] [ENV_EXAMPLE_FILE] [ENVIRONMENT]

echo "🚀 GitHub Environment Variables Setup"
echo "======================================"
echo ""

# Check if we're in the right directory (scripts folder)
if [ ! -f "../bot-trade/env.example" ]; then
    echo "❌ Error: bot-trade/env.example not found"
    echo "💡 Please run this script from the scripts directory"
    echo "   Current directory: $(pwd)"
    echo "   Looking for: ../bot-trade/env.example"
    exit 1
fi

echo "This script will automatically create GitHub environment variables"
echo "based on your bot-trade/env.example file."
echo ""

# Get GitHub repository information
if git remote -v | grep -q github.com; then
    # Extract GitHub info from git remote
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
ENV_EXAMPLE_FILE="${4:-../bot-trade/env.example}"
ENVIRONMENT="${5:-production}"

# If not provided via command line, prompt user
if [ -z "$REPO_OWNER" ]; then
    read -p "🏠 GitHub username/organization [$DEFAULT_OWNER]: " REPO_OWNER
    REPO_OWNER=${REPO_OWNER:-$DEFAULT_OWNER}
fi

if [ -z "$REPO_NAME" ]; then
    read -p "📦 Repository name [$DEFAULT_REPO]: " REPO_NAME  
    REPO_NAME=${REPO_NAME:-$DEFAULT_REPO}
fi

if [ -z "$ENVIRONMENT" ]; then
    read -p "🌍 Environment (production/staging) [production]: " ENVIRONMENT
    ENVIRONMENT=${ENVIRONMENT:-production}
fi

if [[ ! "$ENVIRONMENT" =~ ^(production|staging)$ ]]; then
    echo "❌ Invalid environment. Choose 'production' or 'staging'."
    exit 1
fi

echo "🚀 Selected environment: $ENVIRONMENT"

if [ -z "$GIT_TOKEN" ]; then
    echo ""
    echo "🔑 You need a GitHub Personal Access Token with 'repo' permissions."
    echo "📝 Create one at: https://github.com/settings/tokens/new"
    echo "   - Select 'repo' scope (full repository access)"
    echo "   - Copy the token (it starts with 'ghp_' or 'github_pat_')"
    echo ""
    
    read -s -p "🔐 GitHub Personal Access Token (GIT_TOKEN): " GIT_TOKEN
    echo ""
fi

# Validate required parameters
if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ] || [ -z "$GIT_TOKEN" ]; then
    echo "❌ Error: All fields are required"
    echo "❌ Usage: $0 [REPO_OWNER] [REPO_NAME] [GIT_TOKEN] [ENV_EXAMPLE_FILE] [ENVIRONMENT]"
    echo "   Example: $0 myuser trading-app ghp_xxxxx ../bot-trade/env.example production"
    echo ""
    echo "💡 Get your GitHub token from: https://github.com/settings/tokens"
    echo "   Required permissions: repo (full repository access)"
    exit 1
fi

if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
    echo "❌ Environment example file not found: $ENV_EXAMPLE_FILE"
    exit 1
fi

# Normalize environment name
ENVIRONMENT=$(echo "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')

echo ""
echo "📋 Configuration:"
echo "   Repository: $REPO_OWNER/$REPO_NAME"
echo "   Environment: $ENVIRONMENT"
echo "   Source file: $ENV_EXAMPLE_FILE"
echo "   Token: ${GIT_TOKEN:0:8}..." 
echo ""

# Ask for confirmation if running interactively
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    read -p "🚀 Continue with setup? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

echo ""
echo "🔧 Starting setup..."

# Function to create GitHub environment-specific variable
create_environment_variable() {
    local name="$1"
    local value="$2"
    local env="$3"
    
    # Skip empty values or comments
    if [ -z "$name" ] || [ -z "$value" ] || [[ "$name" =~ ^#.* ]]; then
        return 0
    fi
    
    echo "  🌍 Creating environment variable: $name for $env"
    
    # Prepare the JSON payload for environment variable
    payload="{\"name\":\"$name\",\"value\":\"$value\"}"
    
    # Create environment-specific variable
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: token $GIT_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$env/variables" \
        -d "$payload")
    
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 201 ]; then
        echo "    ✅ Created successfully in $env environment"
        return 0
    elif [ "$http_code" -eq 409 ]; then
        echo "    ⚠️  Variable already exists in $env environment, updating..."
        # Update existing environment variable
        update_response=$(curl -s -w "\n%{http_code}" -X PATCH \
            -H "Authorization: token $GIT_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$env/variables/$name" \
            -d "$payload")
        
        update_http_code=$(echo "$update_response" | tail -n1)
        if [ "$update_http_code" -eq 204 ]; then
            echo "    ✅ Updated successfully in $env environment"
            return 0
        else
            echo "    ❌ Failed to update: $(echo "$update_response" | head -n -1)"
        fi
    else
        echo "    ❌ Failed to create: $(echo "$response_body")"
    fi
    
    return 1
}

# Ensure the selected environment exists and is configured
ensure_environment() {
    local env="$1"

    if [ -z "$env" ]; then
        echo "❌ Environment name is required when ensuring configuration"
        return 1
    fi

    echo "🌐 Configuring $env environment..."

    # Check and create environment if it doesn't exist
    env_check_response=$(curl -s -w "\n%{http_code}" -H "Authorization: token $GIT_TOKEN" \
                              -H "Accept: application/vnd.github+json" \
                              "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$env")

    http_code=$(echo "$env_check_response" | tail -n1)

    if [ "$http_code" -eq 404 ]; then
        echo "  🆕 $env environment not found. Creating..."

        # Create environment with deployment protection rules
        create_env_response=$(curl -s -w "\n%{http_code}" -X PUT \
            -H "Authorization: token $GIT_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/environments/$env" \
            -d '{
                "wait_timer": 0,
                "reviewers": [],
                "deployment_branch_policy": {
                    "protected_branches": false,
                    "custom_branch_policies": false
                },
                "environment_protection_rules": [
                    {
                        "type": "branch_protection_rule"
                    }
                ]
            }')

        create_env_code=$(echo "$create_env_response" | tail -n1)

        if [ "$create_env_code" -ne 200 ] && [ "$create_env_code" -ne 201 ]; then
            echo "  ❌ Failed to create $env environment"
            echo "     Response: $(echo "$create_env_response" | head -n -1)"
            return 1
        fi
    elif [ "$http_code" -ne 200 ]; then
        echo "  ❌ Error checking $env environment"
        echo "     Response: $(echo "$env_check_response" | head -n -1)"
        return 1
    fi

    local env_lower
    env_lower=$(echo "$env" | tr '[:upper:]' '[:lower:]')

    # Predefined critical environment variables
    local critical_vars=(
        "NODE_ENV:$env_lower"
        "DOCKER_REGISTRY:docker.io"
        "DOCKER_NAMESPACE:$REPO_OWNER"
        "TELEGRAM_ENABLED:true"
    )

    # Add critical variables to environment
    for var in "${critical_vars[@]}"; do
        IFS=':' read -r name value <<< "$var"
        create_environment_variable "$name" "$value" "$env"
    done

    echo "✅ $env environment configured successfully"
}

# Call this function before processing variables
ensure_environment "$ENVIRONMENT"

# Parse env.example file and create variables
echo "⚙️  Processing environment variables from $ENV_EXAMPLE_FILE..."

while IFS= read -r line; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^[[:space:]]*# ]] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
        continue
    fi
    
    # Extract variable name and value
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # Skip empty values or sensitive variables that should be secrets
        if [ -z "$var_value" ] || [[ "$var_name" =~ TOKEN|PASSWORD|KEY|SECRET ]]; then
            continue
        fi
        
        # Clean up the value (remove quotes if present)
        var_value=$(echo "$var_value" | sed 's/^["'\'']\|["'\'']$//g')
        
        # Create environment-specific variables only
        if [[ ! "$var_name" =~ TOKEN|PASSWORD|KEY|SECRET ]]; then
            create_environment_variable "$var_name" "$var_value" "$ENVIRONMENT"
        fi
    fi
done < "$ENV_EXAMPLE_FILE"

echo ""
echo "✅ GitHub variables setup completed!"
echo ""
echo "🔒 IMPORTANT: You still need to manually set these GitHub SECRETS:"
echo "   (Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions)"
echo ""

echo "📦 Docker Hub Secrets:"
echo "   DOCKER_USERNAME=your-dockerhub-username"
echo "   DOCKER_PASSWORD=your-dockerhub-token"
echo ""

echo "🤖 Application Secrets:"
echo "   TELEGRAM_BOT_TOKEN=your-telegram-bot-token"
echo "   TELEGRAM_CHAT_ID=your-telegram-chat-id"
echo "   GITHUB_TOKEN=your-github-token"
echo ""

echo "☁️  Cloud Provider Secrets (choose one or more):"
echo ""
echo "   Oracle Cloud (OCI):"
echo "   OCI_HOST=your-oracle-instance-ip"
echo "   OCI_USER=ubuntu"
echo "   OCI_SSH_KEY=your-private-ssh-key"
echo ""
echo "   AWS EC2:"
echo "   AWS_HOST=your-ec2-instance-ip"
echo "   AWS_USER=ec2-user"
echo "   AWS_SSH_KEY=your-ec2-private-key"
echo ""
echo "   Generic VPS:"
echo "   VPS_HOST=your-vps-ip"
echo "   VPS_USER=root"
echo "   VPS_SSH_KEY=your-vps-private-key"
echo ""

echo "💡 Next steps:"
echo "   1. Set the secrets above in GitHub"
echo "   2. Push code to master branch to trigger build"
echo "   3. Check GitHub Actions for build results"
echo "   4. When ready, uncomment deploy job in workflow"
echo ""

# Create a summary file in project root
cat > ../github-setup-summary.md << EOF
# GitHub Environment Setup Summary

Generated on: $(date)
Repository: $REPO_OWNER/$REPO_NAME

## ✅ Variables Created

The following variables were automatically created in your GitHub repository:

### 🌐 ${ENVIRONMENT^} Environment Variables
Environment variables were created for the ${ENVIRONMENT^} environment.

## 🌍 Environment Configuration

### ${ENVIRONMENT^} Environment
- **Status**: Created/Verified
- **Branch Policies**: Unrestricted
- **Reviewers**: None
- **Wait Timer**: 0 seconds

## 🔒 Secrets Still Needed

You need to manually create these secrets in GitHub:

### Docker Hub
- \`DOCKER_USERNAME\`: Your Docker Hub username
- \`DOCKER_PASSWORD\`: Your Docker Hub token

### Application Secrets
- \`TELEGRAM_BOT_TOKEN\`: Your Telegram bot token
- \`TELEGRAM_CHAT_ID\`: Your Telegram chat ID
- \`GITHUB_TOKEN\`: Your GitHub token

### Cloud Provider Secrets (choose one or more)

#### Oracle Cloud (OCI)
- \`OCI_HOST\`: Your Oracle instance IP
- \`OCI_USER\`: ubuntu
- \`OCI_SSH_KEY\`: Your private SSH key

#### AWS EC2
- \`AWS_HOST\`: Your EC2 instance IP
- \`AWS_USER\`: ec2-user
- \`AWS_SSH_KEY\`: Your EC2 private key

#### Generic VPS
- \`VPS_HOST\`: Your VPS IP
- \`VPS_USER\`: root
- \`VPS_SSH_KEY\`: Your VPS private key

EOF

echo "📚 For detailed setup instructions, see ../github-setup-summary.md"
echo ""
echo "🎯 Next steps:"
echo "   1. Go to https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo "   2. Add the required secrets (Docker Hub, Telegram, SSH keys)"
echo "   3. Push code to master branch to test the build"
echo "   4. Check https://github.com/$REPO_OWNER/$REPO_NAME/actions for results"
echo ""
echo "✨ Setup completed!"
