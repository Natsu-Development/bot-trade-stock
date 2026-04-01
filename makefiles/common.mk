# Common Makefile Variables and Settings

# Colors for output
BLUE=\033[34m
GREEN=\033[32m
YELLOW=\033[33m
RED=\033[31m
CYAN=\033[36m
NC=\033[0m

# Project directories
PROJECT_ROOT=$(shell pwd)
GO_SERVICE_DIR=bot-trade
DOCKER_DIR=docker

# Docker settings
DOCKER_COMPOSE_FILE=$(DOCKER_DIR)/docker-compose.yml

# Common functions
define print_header
	@echo ""
	@echo "$(CYAN)===========================================$(NC)"
	@echo "$(CYAN)  $(1)$(NC)"
	@echo "$(CYAN)===========================================$(NC)"
	@echo ""
endef

define print_success
	@echo "$(GREEN)✅ $(1)$(NC)"
endef

define print_info
	@echo "$(BLUE)ℹ️  $(1)$(NC)"
endef

define print_warning
	@echo "$(YELLOW)⚠️  $(1)$(NC)"
endef

define print_error
	@echo "$(RED)❌ $(1)$(NC)"
endef
