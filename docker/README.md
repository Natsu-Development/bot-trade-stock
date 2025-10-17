# Docker Configuration

This directory contains all Docker-related configuration files for the Trading project, organized for easy maintenance.

## 📁 Directory Structure

```
docker/
├── docker-compose.yml          # Main compose configuration
├── README.md                   # This documentation
├── Dockerfile.broker           # Python gRPC broker service
├── Dockerfile.bot-trade        # Go trading bot service
├── .dockerignore.broker        # Broker service ignore rules
└── .dockerignore.bot-trade     # Bot-trade service ignore rules
```

## 🚀 Quick Start

```bash
# From project root directory
make docker-up          # Build and start all services
make docker-logs        # View logs from all services
make docker-down        # Stop all services
```

## 🔧 Services

### 1. Broker Service (Python)
- **File**: `Dockerfile.broker`
- **Port**: 50051 (gRPC)
- **Purpose**: Stock data provider using vnstock
- **Dependencies**: None

### 2. Bot-Trade Service (Go)
- **File**: `Dockerfile.bot-trade`
- **Port**: 8080 (HTTP)
- **Purpose**: Trading analysis and API endpoints
- **Dependencies**: Broker service
- **Environment**: Loads from `../bot-trade/.env`

## ⚙️ Configuration

### Environment Files
- **../bot-trade/env.example**: Environment template for bot-trade service
- **../bot-trade/.env**: Actual bot-trade environment file (git-ignored)

### Docker Ignore Files
- **.dockerignore.broker**: Excludes Python cache, venv, logs
- **.dockerignore.bot-trade**: Excludes Go binaries, build artifacts

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
make docker-logs-broker # Broker service only
make docker-ps          # Container status
make docker-stats       # Resource usage
```

### Advanced Operations
```bash
make docker-rebuild     # Rebuild and restart
make docker-clean       # Remove all containers/volumes
make docker-shell-bot   # Shell into bot container
make docker-shell-broker # Shell into broker container
```

## 🌐 Networking

- **Network**: `trading-network` (bridge)
- **Internal Communication**: Services use service names (e.g., `broker:50051`)
- **External Access**: 
  - Bot API: `http://localhost:8080`
  - Broker gRPC: `localhost:50051`

## 🔒 Security Notes

1. **Environment Files**: Never commit `.env` files with sensitive data
2. **Docker Ignore**: Properly configured to exclude sensitive files
## 📦 Build Contexts and .dockerignore

- We use per-service build contexts so each service can own its ignore rules.
  - Bot-Trade image: context is `bot-trade/`, Dockerfile at `docker/Dockerfile.bot-trade`, rules in `bot-trade/.dockerignore` (implicit via context).
  - Broker image: context is `broker/`, Dockerfile at `docker/Dockerfile.broker`, rules in `broker/.dockerignore` (implicit via context).
- The files in `docker/.dockerignore.*` document suggested ignores and can be copied into each service directory as `.dockerignore` when needed.

3. **Network Isolation**: Services communicate only within Docker network
4. **Health Checks**: Both services have health monitoring

## 🛠 Maintenance

### Adding New Services
1. Create `Dockerfile.servicename`
2. Add corresponding `.dockerignore.servicename`
3. Update `docker-compose.yml`
4. Update this README

### Updating Configuration
1. Modify environment template in `../bot-trade/env.example`
2. Update environment variables in `../bot-trade/.env`
3. Rebuild images: `make docker-rebuild`

### Troubleshooting
```bash
# Check service status
make docker-ps

# View specific service logs
make docker-logs-bot

# Test connectivity
make docker-test

# Clean rebuild
make docker-clean && make docker-up
```

## 📋 Environment Variables

### Service-Level (bot-trade/.env)
- `GRPC_SERVER_ADDR`: Overridden to `broker:50051` for Docker
- `HTTP_PORT`: Internal service port
- Trading-specific configuration (see `../bot-trade/env.example`)

This organized structure makes Docker configuration maintainable and scalable! 🎯