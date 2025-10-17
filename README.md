# Trading Bot System 📈

A high-performance trading bot system with microservices architecture, utilizing gRPC for efficient stock data retrieval and analysis.

## 🏗️ Architecture

### Services
- **Broker Service** (Python): gRPC server for Vietnamese stock market data
- **Bot-Trade Service** (Go): HTTP API for divergence analysis with scheduled jobs

### Key Features
- ✅ Microservices architecture with gRPC communication
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
# Setup Python environment
make python-setup

# Generate protobuf files
make proto-gen

# Start development services
make dev
```

## 📊 API Endpoints

- `GET /health` - System health check
- `GET /analyze/{symbol}/divergence/bullish` - Bullish divergence analysis
- `GET /analyze/{symbol}/divergence/bearish` - Bearish divergence analysis

## ⚙️ Configuration

Environment variables are configured in `bot-trade/env.example`:

```bash
# Trading Configuration
RSI_PERIOD=14
RSI_OVERBOUGHT_THRESHOLD=70
RSI_OVERSOLD_THRESHOLD=30
DEFAULT_SYMBOLS=VIC,VCB,BID,CTG,TCB

# Analysis Settings
BEARISH_1D_ENABLED=true
BULLISH_1D_ENABLED=true
LOG_LEVEL=info

# Telegram Notifications
TELEGRAM_ENABLED=true
```

## 🌩️ Cloud Deployment

The system supports multiple cloud providers:

- **Oracle Cloud Infrastructure (OCI)**
- **AWS EC2**
- **Generic VPS**

Deployment is automated via GitHub Actions. Push to `master` branch to deploy to production.

## 🔧 Development Commands

```bash
# Docker Management
make docker-up       # Start services
make docker-down     # Stop services
make docker-logs     # View logs
make docker-test     # Test API
make docker-restart  # Restart services

# Development
make python-setup    # Setup Python environment
make proto-gen       # Generate protobuf files
make dev             # Start development mode
```

## 📈 Trading Strategy

The bot analyzes RSI divergences:

1. **Bullish Divergence**: Price makes lower lows, RSI makes higher lows
2. **Bearish Divergence**: Price makes higher highs, RSI makes lower highs

Analysis runs on scheduled intervals and sends notifications via Telegram.

## 🛠️ Troubleshooting

### Common Issues

**Services not starting:**
```bash
make docker-logs  # Check logs
make docker-restart  # Restart services
```

**API not responding:**
```bash
make docker-test  # Test endpoints
```

**GitHub deployment fails:**
- Check all required secrets are set
- Verify GitHub token has `repo` permissions
- Review GitHub Actions logs

## 📚 Project Structure

```
Trading/
├── bot-trade/           # Go trading bot service
├── broker/              # Python gRPC broker service
├── scripts/             # Deployment and setup scripts
├── docker/              # Docker configurations
├── proto/               # Protocol buffer definitions
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