# Main Makefile for Trading Project
# This file orchestrates all project operations by including modular makefiles

# Include all modular makefiles
include makefiles/common.mk
include makefiles/development.mk
include makefiles/docker.mk

# Default target
.DEFAULT_GOAL := help

# Project setup - complete initialization
.PHONY: setup
setup: install-dev-deps
	$(call print_header,"Project Setup Complete")
	$(call print_success,"Trading project is ready for development!")
	$(call print_info,"Run 'make dev' to start development environment")
	$(call print_info,"Run 'make docker-up' to start with Docker")

# Quick start for development
.PHONY: start
start: dev

# Quick start with Docker
.PHONY: start-docker
start-docker: docker-up

# Complete project cleanup
.PHONY: clean
clean: clean-dev docker-clean
	$(call print_header,"Complete Project Cleanup")
	@rm -rf reports/ backups/ logs/
	$(call print_success,"Project cleaned completely")

# Show project status
.PHONY: status
status:
	$(call print_header,"Trading Project Status")
	@make -s dev-status
	@echo ""
	@make -s docker-ps 2>/dev/null || echo "$(YELLOW)⚠️  Docker services not running$(NC)"

# Help target - shows all available commands
.PHONY: help
help:
	$(call print_header,"Trading Project - Available Commands")
	@echo "$(CYAN)🚀 Quick Start:$(NC)"
	@echo "  $(GREEN)setup$(NC)          - Complete project setup (first time)"
	@echo "  $(GREEN)start$(NC)          - Start development environment"
	@echo "  $(GREEN)start-docker$(NC)   - Start with Docker containers"
	@echo ""
	@echo "$(CYAN)📦 Development:$(NC)"
	@echo "  $(GREEN)dev$(NC)            - Start development environment with hot reload"
	@echo "  $(GREEN)golang-dev$(NC)     - Start Go service with hot reload"
	@echo "  $(GREEN)golang-build$(NC)   - Build Go service"
	@echo "  $(GREEN)golang-run$(NC)     - Run Go service"
	@echo "  $(GREEN)stop-services$(NC)  - Stop all running services"
	@echo ""
	@echo "$(CYAN)🐳 Docker:$(NC)"
	@echo "  $(GREEN)docker-up$(NC)      - Build and start Docker containers"
	@echo "  $(GREEN)docker-build$(NC)   - Build Docker images"
	@echo "  $(GREEN)docker-rebuild$(NC) - Rebuild and restart containers"
	@echo "  $(GREEN)docker-down$(NC)    - Stop Docker containers"
	@echo "  $(GREEN)docker-logs$(NC)    - View Docker logs"
	@echo "  $(GREEN)docker-ps$(NC)      - Show container status"
	@echo "  $(GREEN)docker-test$(NC)    - Test API endpoints"
	@echo "  $(GREEN)docker-clean$(NC)   - Clean all Docker resources"
	@echo ""
	@echo "$(CYAN)🧪 Testing & Quality:$(NC)"
	@echo "  $(GREEN)test$(NC)           - Run all tests"
	@echo "  $(GREEN)test-go$(NC)        - Run Go tests"
	@echo "  $(GREEN)lint$(NC)           - Run all linting"
	@echo "  $(GREEN)format$(NC)         - Format all code"
	@echo ""
	@echo "$(CYAN)🧹 Cleanup:$(NC)"
	@echo "  $(GREEN)clean$(NC)          - Complete project cleanup"
	@echo "  $(GREEN)clean-dev$(NC)      - Clean development artifacts"
	@echo "  $(GREEN)clean-golang$(NC)   - Clean Go build artifacts"
	@echo ""
	@echo "$(CYAN)ℹ️  Information:$(NC)"
	@echo "  $(GREEN)status$(NC)         - Show project status"
	@echo "  $(GREEN)dev-status$(NC)     - Show development environment status"
	@echo "  $(GREEN)docker-info$(NC)    - Show Docker system information"
	@echo "  $(GREEN)help$(NC)           - Show this help message"
	@echo ""
	@echo "$(BLUE)📚 For more details, check individual makefiles in makefiles/ directory$(NC)"

# Show version information
.PHONY: version
version:
	$(call print_header,"Version Information")
	@echo "$(BLUE)Trading Project$(NC)"
	@echo "  📍 Location: $(PROJECT_ROOT)"
	@echo ""
	@echo "$(BLUE)System Information:$(NC)"
	@echo "  🖥️  OS: $$(uname -s) $$(uname -r)"
	@echo "  🐹 Go: $$(go version 2>/dev/null || echo 'Not installed')"
	@echo "  🐳 Docker: $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo "  🔧 Docker Compose: $$(docker-compose --version 2>/dev/null || echo 'Not installed')"
