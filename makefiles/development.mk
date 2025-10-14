# Development Environment Makefile

include makefiles/common.mk

# Development targets
.PHONY: dev
dev: proto-gen python-setup golang-dev
	$(call print_success,"Development environment ready!")

# Setup Python environment
.PHONY: python-setup
python-setup:
	$(call print_header,"Setting up Python Environment")
	@cd $(PYTHON_SERVICE_DIR) && \
	python3 -m venv venv && \
	./venv/bin/pip install --upgrade pip && \
	./venv/bin/pip install -r requirements.txt
	$(call print_success,"Python environment setup complete")

# Run Python service standalone
.PHONY: python
python-run:
	$(call print_header,"Starting Python gRPC Server")
	@cd $(PYTHON_SERVICE_DIR) && ./venv/bin/python vnstock_server.py

# Development mode - run Go service with hot reload
.PHONY: golang-dev
golang-dev:
	$(call print_header,"Starting Go Development Environment")
	$(call print_info,"Starting Go HTTP service with hot reload...")
	@cd $(GO_SERVICE_DIR) && air

# Build Go service for production
.PHONY: golang-build
golang-build:
	$(call print_header,"Building Go Service")
	@cd $(GO_SERVICE_DIR) && go build -o server ./cmd/server
	$(call print_success,"Go service built successfully")

# Run Go service standalone
.PHONY: golang-run
golang-run:
	$(call print_header,"Starting Go Service")
	@cd $(GO_SERVICE_DIR) && ./server

# Clean build artifacts for Go service
.PHONY: clean-golang
clean-golang:
	$(call print_info,"Cleaning Go build artifacts...")
	@cd $(GO_SERVICE_DIR) && \
	rm -rf tmp/ && \
	rm -f build-errors.log && \
	rm -f *.log && \
	rm -f server
	$(call print_success,"Go build artifacts cleaned")

# Clean Python cache and virtual environment
.PHONY: clean-python
clean-python:
	$(call print_info,"Cleaning Python artifacts...")
	@cd $(PYTHON_SERVICE_DIR) && \
	rm -rf venv/ && \
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	$(call print_success,"Python artifacts cleaned")

# Clean all development artifacts
.PHONY: clean-dev
clean-dev: clean-golang clean-python
	$(call print_success,"All development artifacts cleaned")

# Stop all running services
.PHONY: stop-services
stop-services:
	$(call print_warning,"Stopping all running services...")
	@pkill -f "python.*vnstock_server.py" || true
	@pkill -f "trading-bot" || true
	@pkill -f "air" || true
	$(call print_success,"All services stopped")

# Show development status
.PHONY: dev-status
dev-status:
	$(call print_header,"Development Environment Status")
	@echo "$(BLUE)Python Environment:$(NC)"
	@if [ -d "$(PYTHON_SERVICE_DIR)/venv" ]; then \
		echo "  $(GREEN)✅ Virtual environment exists$(NC)"; \
		echo "  📍 Location: $(PYTHON_SERVICE_DIR)/venv"; \
	else \
		echo "  $(RED)❌ Virtual environment not found$(NC)"; \
	fi
	@echo ""
	@echo "$(BLUE)Go Environment:$(NC)"
	@if command -v go >/dev/null 2>&1; then \
		echo "  $(GREEN)✅ Go installed:$(NC) $$(go version)"; \
	else \
		echo "  $(RED)❌ Go not found$(NC)"; \
	fi
	@if command -v air >/dev/null 2>&1; then \
		echo "  $(GREEN)✅ Air (hot reload) available$(NC)"; \
	else \
		echo "  $(YELLOW)⚠️  Air not installed (install with: go install github.com/cosmtrek/air@latest)$(NC)"; \
	fi

# Install development dependencies
.PHONY: install-dev-deps
install-dev-deps:
	$(call print_header,"Installing Development Dependencies")
	@if ! command -v air >/dev/null 2>&1; then \
		echo "$(BLUE)Installing Air (Go hot reload)...$(NC)"; \
		go install github.com/cosmtrek/air@latest; \
	fi
	$(call print_success,"Development dependencies installed")
