# Trading Bot System

A high-performance trading bot for automated RSI divergence analysis on the Vietnamese stock market, delivering real-time trading signals via Telegram notifications.

## Features

- RSI Divergence Detection (bullish/bearish patterns)
- Trendline Analysis (support/resistance breakouts)
- Stock Screener with RS Rating filters
- Telegram Notifications
- Web Dashboard with interactive charts
- Multi-Timeframe Support (30m, 1H, 1D, 1W)

## Quick Start

### 1. Setup GitHub Environment

```bash
cd scripts && ./init-github-env.sh
```

### 2. Add Required Secrets

Go to GitHub → Settings → Secrets and variables → Actions

**Required:**
- `DOCKER_USERNAME` / `DOCKER_PASSWORD`
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
- Cloud provider secrets (OCI, AWS, or VPS)

### 3. Deploy

```bash
git push origin master
```

## Local Development

```bash
# Docker (recommended)
make docker-up
make docker-test

# Or manual
make setup
make dev
```

## Deployment

Supported providers:
- Oracle Cloud Infrastructure (OCI)
- AWS EC2
- Generic VPS

Deployment flow:
1. GitHub Actions builds Docker image
2. Pushes to Docker Hub
3. Deploys to VM via SSH (secrets injected at deploy time)
4. Sends Telegram notification

## Trading Strategy

### RS Rating (Relative Strength)
- Ranks stocks by price performance
- Percentile ratings across 1M, 3M, 6M, 9M, 12M periods

### RSI Divergence
- **Bullish**: Price lower lows + RSI higher lows → Buy signal
- **Bearish**: Price higher highs + RSI lower highs → Sell signal

## Security

- Secrets injected via SSH, never in artifacts
- Build fails if secrets detected in artifact
- `.env.secrets` with chmod 600 permissions
- Rate limiting on VietCap API

## Troubleshooting

```bash
# Local issues
make docker-logs
make docker-rebuild
make docker-clean

# Deployment issues
# Check GitHub Actions logs
# SSH to VM: cd /opt/trading-app && docker-compose logs
```

## Documentation

For development details, architecture, API endpoints, and coding conventions, see [CLAUDE.md](./CLAUDE.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test with `make docker-test`
4. Submit a pull request

## License

[Insert License Information]
