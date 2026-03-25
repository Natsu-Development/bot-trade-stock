# Docker Configuration 🐳

Docker configuration for the Trading Bot System with secure deployment practices.

## 📁 Directory Structure

```
docker/
├── docker-compose.yml          # Development compose (with .env)
├── docker-compose.prod.yml     # Production template (uses env_file)
└── README.md                   # This documentation
```

**Note:** Dockerfile is in the service directory:
- `bot-trade/Dockerfile` - Go trading bot service

## 🚀 Quick Start

```bash
# From project root directory
make docker-up          # Build and start all services
make docker-logs        # View logs from all services
make docker-down        # Stop all services
```

## 🔧 Services

### Bot-Trade Service (Go)
- **File**: `bot-trade/Dockerfile`
- **Port**: 8080 (HTTP)
- **Purpose**: Trading analysis and API endpoints
- **Environment**: Loads from `../bot-trade/.env`

## ⚙️ Configuration

### Local Development
Uses `docker-compose.yml` with environment from `bot-trade/.env` file:

```bash
# Create .env from template
cp bot-trade/env.example bot-trade/.env
# Edit with your values
nano bot-trade/.env
```

### Production Deployment
Uses `docker-compose.prod.yml` with secure secret injection:

```yaml
# docker-compose.prod.yml structure
services:
  bot-trade:
    env_file:
      - .env.secrets  # Created during deployment, NOT in artifact
    environment:
      # Non-secret config substituted from GitHub Variables
      - RSI_PERIOD=${RSI_PERIOD}
      - HTTP_PORT=${HTTP_PORT}
```

**Security:** Secrets are injected via SSH during deployment, never stored in artifacts.

### Environment Files
- `bot-trade/env.example` - Template with all variables
- `bot-trade/.env` - Local development (git-ignored)
- `.env.secrets` - Production secrets (created on VM only)

## 🐳 Docker Commands

### Basic Operations
```bash
make docker-up          # Build and start containers
make docker-build       # Build images only
make docker-down        # Stop containers
make docker-restart     # Restart services
```

### Monitoring & Debugging
```bash
make docker-logs        # All service logs
make docker-logs-bot    # Bot service only
make docker-ps          # Container status
make docker-stats       # Resource usage
```

### Advanced Operations
```bash
make docker-rebuild     # Rebuild and restart
make docker-clean       # Remove all containers/volumes
make docker-shell-bot   # Shell into bot container
```

## 🌐 Networking

- **Network**: `trading-network` (bridge)
- **External Access**:
  - Bot API: `http://localhost:8080`

## 🔒 Security Best Practices

### Local Development
1. ✅ **Never commit** `.env` files with real secrets
2. ✅ Use `.env.example` as template only
3. ✅ `.dockerignore` properly configured in service directory

### Production Deployment
1. ✅ **Secrets in artifacts**: NEVER - secrets injected via SSH
2. ✅ **Secret storage**: `.env.secrets` on VM only (chmod 600)
3. ✅ **GitHub Variables**: Non-secret config only
4. ✅ **GitHub Secrets**: Sensitive data (TELEGRAM_BOT_TOKEN, etc.)

### Security Flow (Production)
```
GitHub Actions (Build)
  ↓ Creates artifact (NO secrets)
SSH to Production VM
  ↓ Injects secrets
Create .env.secrets (chmod 600)
  ↓ Only on VM, never in artifact
Docker containers read .env.secrets
  ✅ Secure!
```

### Network & Health
- ✅ **Network Isolation**: Services communicate only within Docker network
- ✅ **Health Checks**: Service monitored automatically
- ✅ **Restart Policy**: `unless-stopped` for high availability

## 🛠 Maintenance & Troubleshooting

### Updating Configuration

**Local Development:**
```bash
# 1. Edit .env file
nano bot-trade/.env

# 2. Restart services
make docker-restart
```

**Production:**
```bash
# 1. Update GitHub Variables (non-secret config)
# 2. Update GitHub Secrets (sensitive data)
# 3. Push to trigger new deployment
git push origin master
```

### Common Issues

**Services won't start:**
```bash
make docker-ps              # Check status
make docker-logs            # View all logs
make docker-logs-bot        # Bot service only
make docker-clean && make docker-up  # Clean rebuild
```

**Environment variables not working:**
```bash
# Local: Check .env file
cat bot-trade/.env

# Production: Check .env.secrets on VM
ssh user@server
cat /opt/trading-app/.env.secrets
```

## 📋 Key Environment Variables

**Non-secret (GitHub Variables):**
- `RSI_PERIOD` - RSI calculation period (default: 14)
- `HTTP_PORT` - API server port (default: 8080)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `BEARISH_1D_ENABLED` - Enable daily bearish analysis
- `DEFAULT_SYMBOLS` - Comma-separated stock symbols

**Secrets (GitHub Secrets, production only):**
- `TELEGRAM_BOT_TOKEN` - Telegram bot authentication token
- `TELEGRAM_CHAT_ID` - Telegram chat ID for notifications

See `bot-trade/env.example` for complete list of all variables.

---

🎯 **Simple, Secure, and Scalable Docker Configuration!**