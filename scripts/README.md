# Trading App Deployment Scripts

This directory contains automated deployment and setup scripts for the Trading App.

## 📁 Scripts Overview

```
scripts/
├── init-github-env.sh      # 🚀 Main setup script (recommended)
├── deploy-vps.sh           # Deploy to VPS via SSH
├── vps-setup.sh            # Install Docker on fresh VPS
├── cleanup-github-vars.sh  # Remove old GitHub variables
└── README.md               # This file
```

## 🚀 Quick Setup (Recommended)

### 1. Automated GitHub Setup

Use the main setup script to configure everything automatically:

```bash
# From project root
cd scripts
./init-github-env.sh
```

This interactive script will:
- ✅ Auto-detect your GitHub repository
- ✅ Create production environment in GitHub
- ✅ Set up all environment variables from `bot-trade/env.example`
- ✅ Show you exactly which secrets to add manually

### 2. Add Required Secrets

After running the setup script, add these **GitHub Secrets**:

Go to: `https://github.com/YOUR_USER/YOUR_REPO/settings/secrets/actions`

#### 🐳 Docker Hub (Required)
```
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-access-token
```

#### 📱 Telegram Notifications (Optional)
```
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

#### ☁️ VPS (Required for Deployment)
```
VPS_HOST=your-vps-ip
VPS_USER=root
VPS_SSH_KEY=your-private-key
```

### 3. Deploy

```bash
# Push to master branch to trigger deployment
git add .
git commit -m "Deploy trading bot"
git push origin master
```

## 🔧 Manual Script Usage

### GitHub Environment Setup

```bash
# Interactive mode (recommended)
./init-github-env.sh

# Command line mode
./init-github-env.sh REPO_OWNER REPO_NAME GIT_TOKEN [ENV_FILE] [ENVIRONMENT]

# Example
./init-github-env.sh myuser trading-app ghp_xxxxx ../bot-trade/env.example production
```

### VPS Setup (Fresh Server)

```bash
# Install Docker on a fresh VPS
./vps-setup.sh
```

## 📋 What Gets Created Automatically

The `init-github-env.sh` script creates these **GitHub Environment Variables**:

### 🐳 Docker Configuration
- `DOCKER_REGISTRY=docker.io`
- `DOCKER_NAMESPACE=your-username`

### 📱 Application Settings
- `NODE_ENV=production`

### ⚙️ Trading Bot Configuration
- `RSI_PERIOD=14`
- `RSI_OVERBOUGHT_THRESHOLD=70`
- `RSI_OVERSOLD_THRESHOLD=30`
- `DEFAULT_SYMBOLS=VIC,VCB,BID,CTG,TCB...`
- `BEARISH_1D_ENABLED=true`
- `BULLISH_1D_ENABLED=true`
- `LOG_LEVEL=info`
- ...and all other non-sensitive variables from `env.example`

## 🔐 GitHub Token Setup

### Create a Personal Access Token:

1. **Go to**: https://github.com/settings/tokens/new
2. **Name**: "Trading App CI/CD"
3. **Expiration**: 90 days (or longer)
4. **Scopes**: Select `repo` (Full repository access)
5. **Generate** and copy the token

⚠️ **Important**: Save the token immediately - you won't see it again!

## ✅ Verification Checklist

After setup, verify everything is working:

### 1. Check Environment Variables
- [ ] Go to repo Settings → Environments → production
- [ ] Verify all trading variables are present
- [ ] Confirm Docker registry settings

### 2. Check Secrets
- [ ] Go to repo Settings → Secrets → Actions
- [ ] Verify Docker Hub credentials
- [ ] Confirm VPS secrets
- [ ] Test Telegram bot (optional)

### 3. Test Build
- [ ] Push to master branch
- [ ] Check GitHub Actions tab
- [ ] Verify images built successfully
- [ ] Check Docker Hub for new images

## 🛠️ Troubleshooting

### ❌ "Permission denied" error
```bash
# Make sure the script is executable
chmod +x init-github-env.sh
```

### ❌ "File not found: env.example"
```bash
# Make sure you're in the scripts directory
cd scripts
ls ../bot-trade/env.example  # should exist
```

### ❌ "GitHub API error"
- Check your token has `repo` permissions
- Verify repository name and owner are correct
- Ensure token hasn't expired

### ❌ Variables not appearing in GitHub
- Check token permissions
- Verify repository access
- Try refreshing the GitHub environment page

## 🔄 Updating Variables

To add new environment variables:

### Option 1: Use the script again
```bash
# Add new variables to bot-trade/env.example
cd scripts
./init-github-env.sh
```

### Option 2: Add manually
1. Go to repo Settings → Environments → production
2. Click "Add environment variable"
3. Add name and value
4. Variables are automatically picked up on next push

## 🔒 Security Features

- **Secrets Management**: Sensitive data stored in GitHub Secrets
- **SSH Key Authentication**: No password-based authentication
- **Container Isolation**: Services run in isolated Docker containers
- **Health Checks**: Monitors service health during deployment

## 📊 Monitoring & Logging

- **Health Checks**: Automatic service health monitoring
- **Deployment Logs**: Comprehensive logging of deployment process
- **Container Logs**: Access to application logs via Docker
- **Telegram Notifications**: Real-time deployment status updates