# Docker Management Makefile

include makefiles/common.mk

# Build and start Docker containers
.PHONY: docker-up
docker-up:
	$(call print_header,"Starting Docker Services")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) up -d
	$(call print_success,"Docker containers started")
	$(call print_info,"Access API at: http://localhost:8080")
	$(call print_info,"gRPC Broker at: localhost:50051")

# Build Docker images
.PHONY: docker-build
docker-build:
	$(call print_header,"Building Docker Images")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) build
	$(call print_success,"Docker images built successfully")

# Rebuild and start Docker containers
.PHONY: docker-rebuild
docker-rebuild:
	$(call print_header,"Rebuilding and Starting Docker Services")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) up -d --build
	$(call print_success,"Docker containers rebuilt and started")

# Stop Docker containers
.PHONY: docker-down
docker-down:
	$(call print_warning,"Stopping Docker containers...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) down
	$(call print_success,"Docker containers stopped")

# Stop and remove all Docker resources (including volumes)
.PHONY: docker-clean
docker-clean:
	$(call print_warning,"Removing all Docker resources...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) down -v --remove-orphans
	@docker system prune -f
	$(call print_success,"Docker resources cleaned")

# View Docker logs (all services)
.PHONY: docker-logs
docker-logs:
	$(call print_info,"Showing Docker service logs (Ctrl+C to exit)...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) logs -f

# View Docker logs for bot-trade service
.PHONY: docker-logs-bot
docker-logs-bot:
	$(call print_info,"Showing bot-trade service logs (Ctrl+C to exit)...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) logs -f bot-trade

# View Docker logs for broker service
.PHONY: docker-logs-broker
docker-logs-broker:
	$(call print_info,"Showing broker service logs (Ctrl+C to exit)...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) logs -f broker

# Show Docker container status
.PHONY: docker-ps
docker-ps:
	$(call print_header,"Docker Container Status")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) ps

# Restart Docker services
.PHONY: docker-restart
docker-restart:
	$(call print_warning,"Restarting Docker services...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) restart
	$(call print_success,"Docker services restarted")

# Execute shell in bot-trade container
.PHONY: docker-shell-bot
docker-shell-bot:
	$(call print_info,"Opening shell in bot-trade container...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) exec bot-trade sh

# Execute shell in broker container
.PHONY: docker-shell-broker
docker-shell-broker:
	$(call print_info,"Opening shell in broker container...")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) exec broker bash

# Test API health and endpoints
.PHONY: docker-test
docker-test:
	$(call print_header,"Testing API Endpoints")
	@echo "$(YELLOW)Health Check:$(NC)"
	@curl -s http://localhost:8080/health | jq . 2>/dev/null || curl -s http://localhost:8080/health
	@echo ""
	@echo "$(YELLOW)Bullish Divergence Test (VIC):$(NC)"
	@curl -s http://localhost:8080/analyze/VIC/divergence/bullish | jq . 2>/dev/null || curl -s http://localhost:8080/analyze/VIC/divergence/bullish

# Show Docker system information
.PHONY: docker-info
docker-info:
	$(call print_header,"Docker System Information")
	@echo "$(BLUE)Docker Version:$(NC)"
	@docker --version
	@echo ""
	@echo "$(BLUE)Docker Compose Version:$(NC)"
	@docker-compose --version
	@echo ""
	@echo "$(BLUE)Running Containers:$(NC)"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "$(BLUE)Images:$(NC)"
	@docker images --filter reference="trading-*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Monitor Docker resource usage
.PHONY: docker-stats
docker-stats:
	$(call print_info,"Monitoring Docker container resource usage (Ctrl+C to exit)...")
	@docker stats

# Update Docker images to latest versions
.PHONY: docker-update
docker-update:
	$(call print_header,"Updating Docker Images")
	@docker-compose -f $(DOCKER_COMPOSE_FILE) pull
	$(call print_success,"Docker images updated")

# Backup Docker volumes (if any)
.PHONY: docker-backup
docker-backup:
	$(call print_header,"Creating Docker Backup")
	@mkdir -p backups
	@docker-compose -f $(DOCKER_COMPOSE_FILE) exec -T broker tar czf - /app > backups/broker-backup-$$(date +%Y%m%d-%H%M%S).tar.gz || true
	@docker-compose -f $(DOCKER_COMPOSE_FILE) exec -T bot-trade tar czf - /root > backups/bot-trade-backup-$$(date +%Y%m%d-%H%M%S).tar.gz || true
	$(call print_success,"Docker backup completed in backups/ directory")
