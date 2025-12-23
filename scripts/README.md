# Trading App Deployment Scripts

This directory contains automated deployment and setup scripts for the Trading App.

## 📁 Scripts Overview

```
scripts/
├── init-github-env.sh      # 🚀 Main setup script (recommended)
├── fetch-github-vars.sh    # Fetch environment variables from GitHub
├── build-config.sh         # Build docker-compose with env vars
├── deploy-generic.sh       # Generic deployment script
├── configs/                # Cloud provider configurations
│   ├── oracle-cloud.json  # Oracle Cloud Infrastructure (OCI)
│   ├── aws-ec2.json        # Amazon Web Services EC2
│   └── generic-vps.json     # Generic VPS/VM
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

#### ☁️ Cloud Provider (Choose One)

**Oracle Cloud:**
```
OCI_HOST=your-instance-ip
OCI_USER=ubuntu
OCI_SSH_KEY=your-private-key
```

**AWS EC2:**
```
AWS_HOST=your-ec2-ip
AWS_USER=ec2-user
AWS_SSH_KEY=your-ec2-private-key
```

**Generic VPS:**
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

### Fetch Environment Variables

```bash
./fetch-github-vars.sh OWNER REPO TOKEN [OUTPUT_FILE]

# Example
./fetch-github-vars.sh myuser trading-app ghp_xxxxx vars.env
```

### Build Configuration

```bash
./build-config.sh TEMPLATE ENV_FILE REGISTRY TAG [SECRETS] [OUTPUT]

# Example
./build-config.sh ../docker/docker-compose.prod.yml vars.env myuser/trading v1.0.0
```

### Deploy to Cloud

```bash
./deploy-generic.sh PROVIDER [CONFIG_FILE]

# Examples
./deploy-generic.sh oracle
./deploy-generic.sh aws
./deploy-generic.sh generic
```

## 🌩️ Cloud Provider Support

### Oracle Cloud Infrastructure (OCI)
- Automatic Docker installation
- Firewall configuration (ufw)
- Health monitoring
- Optimized for OCI networking

### AWS EC2
- Multi-OS support (Amazon Linux, Ubuntu)
- Docker Compose installation
- Security group configuration
- CloudWatch integration ready

### Generic VPS
- Auto-detects OS (Ubuntu, CentOS, Fedora, Arch)
- Installs Docker and Docker Compose
- Configures available firewall
- Works with most Linux distributions

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
- [ ] Confirm cloud provider secrets
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

## 🎯 Advanced Configuration

### Custom Environment File
```bash
# Use a different env file
./init-github-env.sh USER REPO TOKEN custom.env production
```

### Different Environment
```bash
# Create staging environment
./init-github-env.sh USER REPO TOKEN ../bot-trade/env.example staging
```

## 🔒 Security Features

- **Secrets Management**: Sensitive data stored in GitHub Secrets
- **SSH Key Authentication**: No password-based authentication
- **Firewall Configuration**: Automatically opens required ports
- **Container Isolation**: Services run in isolated Docker containers
- **Health Checks**: Monitors service health during deployment

## 📊 Monitoring & Logging

- **Health Checks**: Automatic service health monitoring
- **Deployment Logs**: Comprehensive logging of deployment process
- **Container Logs**: Access to application logs via Docker
- **Telegram Notifications**: Real-time deployment status updates

## 🤝 Contributing

1. Test changes in `develop` branch first
2. Update cloud configs if needed
3. Update this README for new features
4. Ensure all scripts have proper error handling

## 📝 License

Same license as the main Trading App project.