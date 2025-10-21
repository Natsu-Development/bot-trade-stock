#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Simple VPS Setup - Just Install Docker
# ═══════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "════════════════════════════════════════════════════"
echo "  Simple VPS Setup - Docker Installation"
echo "════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash $0"
    exit 1
fi

echo "✓ Running as root"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 1: Update System
# ═══════════════════════════════════════════════════════════════════
echo "[1/3] Updating system..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg lsb-release jq
echo "✓ System updated"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 2: Install Docker
# ═══════════════════════════════════════════════════════════════════
echo "[2/3] Installing Docker..."

# Remove old versions
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official GPG key and repository
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker

# Create docker-compose alias
cat > /usr/local/bin/docker-compose << 'EOF'
#!/bin/bash
docker compose "$@"
EOF
chmod +x /usr/local/bin/docker-compose

echo "✓ Docker installed: $(docker --version)"
echo "✓ Docker Compose: $(docker-compose version --short)"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 3: Create Deployment Directory
# ═══════════════════════════════════════════════════════════════════
echo "[3/3] Creating deployment directory..."

mkdir -p /opt/trading-app
mkdir -p /opt/trading-app/logs

echo "✓ Created /opt/trading-app"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Done!
# ═══════════════════════════════════════════════════════════════════
echo "════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════════════════"
echo ""
echo "System Info:"
echo "  Docker: $(docker --version)"
echo "  Directory: /opt/trading-app"
echo ""
echo "Ready for deployment! 🚀"
echo ""

