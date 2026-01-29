# Trading Bot System 📈

A high-performance trading bot system with clean architecture, directly integrating with VietCap API for Vietnamese stock market data and analysis.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (HTTP handlers)                           │
├─────────────────────────────────────────────────────────┤
│  Application (Use Cases: RS Rating, Divergence)         │
│      └── uses MarketDataGateway interface               │
├─────────────────────────────────────────────────────────┤
│  Domain (market.PriceData, market.StockInfo)            │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                         │
│      ├── port/market_data.go (interface)                │
│      └── adapter/vietcap_gateway.go (implementation)    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
    [VietCap API]
```

### Key Features
- ✅ Clean Architecture with domain-driven design
- ✅ Direct VietCap API integration (no Python broker needed)
- ✅ RS Rating calculation for all HOSE stocks
- ✅ RSI-based divergence analysis
- ✅ Telegram notifications
- ✅ Docker deployment ready
- ✅ CI/CD with GitHub Actions

## 🚀 Quick Start

### 1. Setup GitHub Environment Variables

```bash
# From project root
cd scripts
./init-github-env.sh
```

This interactive script will:
- Auto-detect your GitHub repository
- Create all environment variables from `bot-trade/env.example`
- Set up production environment in GitHub

### 2. Add Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

**Required Secrets:**
- `DOCKER_USERNAME` - Your Docker Hub username
- `DOCKER_PASSWORD` - Your Docker Hub token
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID

**Cloud Provider Secrets (choose one):**
- `OCI_HOST`, `OCI_USER`, `OCI_SSH_KEY` (Oracle Cloud)
- `AWS_HOST`, `AWS_USER`, `AWS_SSH_KEY` (AWS EC2)
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (Generic VPS)

### 3. Deploy

```bash
# Push to master branch to trigger deployment
git add .
git commit -m "Deploy trading bot"
git push origin master
```

**What happens:**
1. ✅ Builds Docker image → Pushes to Docker Hub
2. ✅ Creates deployment package (NO secrets inside)
3. ✅ Deploys to cloud provider (secrets injected via SSH)
4. ✅ Sends Telegram notification

## 🐳 Local Development

### Docker Compose (Recommended)
```bash
# Start all services
make docker-up

# View logs
make docker-logs

# Test API
make docker-test

# Stop services
make docker-down
```

### Manual Setup
```bash
# Setup development dependencies
make setup

# Start development with hot reload
make dev
```

## 📊 API Endpoints

- `GET /health` - System health check
- `GET /analyze/{symbol}/divergence/bullish` - Bullish divergence analysis
- `GET /analyze/{symbol}/divergence/bearish` - Bearish divergence analysis
- `GET /rs-rating` - Get RS ratings for all HOSE stocks
- `POST /rs-rating/refresh` - Refresh RS ratings cache

## ⚙️ Configuration

Environment variables are configured in `bot-trade/env.example`:

```bash
# Server Configuration
HTTP_PORT=8080

# VietCap API Configuration
VIETCAP_RATE_LIMIT=15  # Requests per minute

# MongoDB Configuration
MONGODB_URI=mongodb://mongo:27017
MONGODB_DATABASE=bot_trade

# Analysis Settings
BEARISH_1D_ENABLED=true
BULLISH_1D_ENABLED=true
LOG_LEVEL=info
```

## 🌩️ Cloud Deployment

### Supported Providers
- **Oracle Cloud Infrastructure (OCI)**
- **AWS EC2**
- **Generic VPS**

### Deployment Flow (Secure & Automated)

```
┌─────────────────────────────────────────────┐
│ GitHub Actions (Build)                      │
│ • Build Docker image                        │
│ • Push to Docker Hub                        │
│ • Create deployment package (NO secrets)    │
└─────────────────────────────────────────────┘
                    ↓ SSH
┌─────────────────────────────────────────────┐
│ Production VM (Deploy)                      │
│ • Download artifact                         │
│ • Inject secrets via SSH                    │
│ • Create .env.secrets (chmod 600)           │
│ • Start containers                          │
└─────────────────────────────────────────────┘
```

**Security:** Secrets are NEVER stored in artifacts, only injected via SSH during deployment.

## 🔧 Development Commands

```bash
# Docker Management
make docker-up       # Start services
make docker-down     # Stop services
make docker-logs     # View logs
make docker-test     # Test API
make docker-rebuild  # Rebuild and restart

# Development
make setup           # First-time setup
make dev             # Start with hot reload
make golang-build    # Build production binary
```

## 📈 Trading Strategy

The bot analyzes two main strategies:

### 1. RS Rating (Relative Strength)
- Ranks all HOSE stocks by price performance
- Calculates percentile ratings for 1M, 3M, 6M, 9M, 12M periods
- Higher RS rating = stronger relative performance

### 2. RSI Divergence
- **Bullish Divergence**: Price makes lower lows, RSI makes higher lows
- **Bearish Divergence**: Price makes higher highs, RSI makes lower highs

Analysis runs on scheduled intervals and sends notifications via Telegram.

## 🔒 Security Features

- ✅ **Secure Secret Management**: Secrets injected via SSH, never in artifacts
- ✅ **Automatic Verification**: Build fails if secrets detected in artifact
- ✅ **Encrypted Transmission**: All secrets passed via encrypted SSH connection
- ✅ **Secure Storage**: `.env.secrets` on VM with chmod 600 permissions
- ✅ **No Git Exposure**: Secrets never committed to repository
- ✅ **Rate Limiting**: Built-in VietCap API rate limiting

## 🛠️ Troubleshooting

### Local Development Issues

**Services not starting:**
```bash
make docker-logs        # Check logs
make docker-rebuild     # Restart services
make docker-clean       # Clean rebuild
```

**API not responding:**
```bash
make docker-test        # Test endpoints
make docker-ps          # Check container status
```

### Deployment Issues

**GitHub Actions build fails:**
- ✅ Check GitHub Variables are configured (Settings → Secrets and variables → Variables)
- ✅ Check required Secrets are set (Settings → Secrets and variables → Secrets)
- ✅ Review GitHub Actions logs for specific errors

**Deployment to cloud fails:**
- ✅ Verify cloud provider secrets (OCI_HOST, OCI_USER, OCI_SSH_KEY, etc.)
- ✅ Check SSH key format (should be private key, no passphrase)
- ✅ Ensure VM has Docker and docker-compose installed

**Containers not starting on VM:**
```bash
# SSH to your VM
ssh user@your-server

# Check if .env.secrets exists
ls -la /opt/trading-app/.env.secrets

# Check container logs
cd /opt/trading-app
docker-compose logs
```

## 📚 Project Structure

```
Trading/
├── bot-trade/           # Go trading bot service
│   ├── application/     # Use cases and application services
│   ├── domain/          # Business logic and entities
│   ├── infrastructure/  # External integrations (VietCap, MongoDB)
│   ├── presentation/    # HTTP handlers and routes
│   └── wire/            # Dependency injection
├── scripts/             # Deployment and setup scripts
├── docker/              # Docker configurations
├── makefiles/           # Modular makefile targets
└── .github/workflows/   # CI/CD workflows
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `make docker-test`
5. Submit a pull request

## 📄 License

[Insert License Information]

---

🚀 **Happy Trading!** 📈
