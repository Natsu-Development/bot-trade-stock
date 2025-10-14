# Trading Bot System 📈

## Overview

A high-performance trading bot system with microservices architecture, utilizing gRPC for efficient stock data retrieval and analysis.

## System Components

### 1. Broker Service (Python)
- gRPC server for stock data retrieval
- Uses vnstock for Vietnamese stock market data
- Persistent connection with caching mechanism

### 2. Bot-Trade Service (Go)
- HTTP API for divergence analysis
- Cron-based scheduled jobs
- Clean Architecture implementation

## Deployment Options

### 🐳 Docker Compose (Recommended)
```bash
# Quick start
make docker-up

# Test API
make docker-test

# View logs
make docker-logs
```

### 💻 Local Development
```bash
# Setup Python environment
make python-setup

# Generate protobuf files
make proto-gen

# Start services
make dev
```

## Key Features

- ✅ Microservices architecture
- ✅ gRPC communication
- ✅ Divergence analysis
- ✅ Telegram notifications
- ✅ Flexible configuration
- ✅ Docker deployment

## Deployment Methods

1. **Docker Compose**: Easiest, recommended for most users
2. **Local Development**: For active development
3. **Manual Setup**: For custom infrastructure

## Quick Commands

```bash
# Docker Management
make docker-up       # Start services
make docker-down     # Stop services
make docker-logs     # View logs
make docker-test     # Test API

# Development
make python-setup    # Setup Python env
make proto-gen       # Generate protobuf
make dev             # Start development
```

## Configuration

- Environment variables in `docker.env.example`
- Customize stock symbols, cron schedules
- Optional Telegram notifications

## API Endpoints

- `/health`: System health check
- `/analyze/{symbol}/divergence/bullish`: Bullish divergence
- `/analyze/{symbol}/divergence/bearish`: Bearish divergence

## Performance Optimization

- Connection pooling
- In-memory caching
- Efficient data processing
- Minimal overhead design

## Monitoring & Logging

- Structured logging
- Health checks
- Docker container monitoring

## Security

- Isolated services
- Configurable timeouts
- Optional Telegram alerts

## Scaling

- Horizontal scaling for broker service
- Stateless design
- Resource-efficient

## Troubleshooting

- Check logs: `make docker-logs`
- Verify services: `make docker-ps`
- Restart: `make docker-restart`

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push and create Pull Request

## License

[Insert License Information]

## Support

- Open GitHub issues
- Check documentation
- Community support

## Technologies

- Go 1.23
- Python 3.10
- gRPC
- Docker
- vnstock
- Protocol Buffers

## Performance Metrics

- Low latency stock data retrieval
- Efficient divergence analysis
- Minimal resource consumption

## Future Roadmap

- [ ] Multi-market support
- [ ] Advanced machine learning models
- [ ] Enhanced visualization
- [ ] More trading strategies

---

🚀 **Happy Trading!** 📈
