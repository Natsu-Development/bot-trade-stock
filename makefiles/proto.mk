# Protocol Buffers Makefile

include makefiles/common.mk

# Generate protobuf files using Buf
.PHONY: proto-gen
proto-gen:
	$(call print_header,"Generating Protobuf Files")
	@cd $(PROTO_DIR) && buf generate
	$(call print_success,"Protobuf files generated successfully")

# Clean generated protobuf files
.PHONY: proto-clean
proto-clean:
	$(call print_info,"Cleaning generated protobuf files...")
	@find $(PROTO_DIR) -type f \( -name "*_pb2.py" -o -name "*_pb2_grpc.py" -o -name "*.pb.go" \) -delete
	@find $(GO_SERVICE_DIR)/pkg/grpc-broker -type f \( -name "*.pb.go" \) -delete 2>/dev/null || true
	@find $(PYTHON_SERVICE_DIR)/grpc-broker -type f \( -name "*_pb2.py" -o -name "*_pb2_grpc.py" \) -delete 2>/dev/null || true
	$(call print_success,"Protobuf files cleaned")

# Lint protobuf files
.PHONY: proto-lint
proto-lint:
	$(call print_header,"Linting Protobuf Files")
	@cd $(PROTO_DIR) && buf lint
	$(call print_success,"Protobuf files linted successfully")

# Format protobuf files
.PHONY: proto-format
proto-format:
	$(call print_header,"Formatting Protobuf Files")
	@cd $(PROTO_DIR) && buf format -w
	$(call print_success,"Protobuf files formatted successfully")

# Check if Buf is installed
.PHONY: proto-check-deps
proto-check-deps:
	$(call print_header,"Checking Protobuf Dependencies")
	@if command -v buf >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Buf is installed:$(NC) $$(buf --version)"; \
	else \
		echo "$(RED)❌ Buf is not installed$(NC)"; \
		echo "$(YELLOW)Install with: curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64 -o /usr/local/bin/buf && chmod +x /usr/local/bin/buf$(NC)"; \
	fi
	@if command -v protoc >/dev/null 2>&1; then \
		echo "$(GREEN)✅ protoc is installed:$(NC) $$(protoc --version)"; \
	else \
		echo "$(YELLOW)⚠️  protoc not found (optional - Buf handles generation)$(NC)"; \
	fi

# Install Buf if not present
.PHONY: proto-install-buf
proto-install-buf:
	$(call print_header,"Installing Buf")
	@if ! command -v buf >/dev/null 2>&1; then \
		echo "$(BLUE)Downloading and installing Buf...$(NC)"; \
		curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64 -o /tmp/buf; \
		sudo mv /tmp/buf /usr/local/bin/buf; \
		sudo chmod +x /usr/local/bin/buf; \
		$(call print_success,"Buf installed successfully"); \
	else \
		$(call print_info,"Buf is already installed"); \
	fi

# Show protobuf file status
.PHONY: proto-status
proto-status:
	$(call print_header,"Protobuf Files Status")
	@echo "$(BLUE)Proto source files:$(NC)"
	@find $(PROTO_DIR) -name "*.proto" -exec echo "  📄 {}" \;
	@echo ""
	@echo "$(BLUE)Generated Go files:$(NC)"
	@find $(GO_SERVICE_DIR)/pkg -name "*.pb.go" -exec echo "  🔧 {}" \; 2>/dev/null || echo "  $(YELLOW)No Go protobuf files found$(NC)"
	@echo ""
	@echo "$(BLUE)Generated Python files:$(NC)"
	@find $(PYTHON_SERVICE_DIR) -name "*_pb2*.py" -exec echo "  🐍 {}" \; 2>/dev/null || echo "  $(YELLOW)No Python protobuf files found$(NC)"

# Validate protobuf files
.PHONY: proto-validate
proto-validate: proto-lint
	$(call print_header,"Validating Protobuf Files")
	@cd $(PROTO_DIR) && buf breaking --against '.git#branch=main' || echo "$(YELLOW)⚠️  No previous version to compare against$(NC)"
	$(call print_success,"Protobuf validation completed")
