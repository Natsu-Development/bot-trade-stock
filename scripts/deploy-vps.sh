#!/bin/bash
set -e

APP_DIR="/opt/trading-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSI_BYPASS_SRC="$SCRIPT_DIR/ssi-bypass"

# Setup directory and backup
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -f docker-compose.yml ]; then
    cp docker-compose.yml "docker-compose.backup.$(date +%Y%m%d_%H%M%S).yml"
fi

# Copy configuration files
cp /tmp/docker-compose.yml ./docker-compose.yml
cp /tmp/.env.production ./.env.production

# Create monitoring directory and copy alloy config
mkdir -p monitoring/alloy
if [ -f /tmp/monitoring/alloy/config.alloy ]; then
    cp /tmp/monitoring/alloy/config.alloy ./monitoring/alloy/config.alloy
fi

# Validate required secrets
validate_secrets() {
    local missing=()
    [ -z "$MONGO_ROOT_USERNAME" ] && missing+=("MONGO_ROOT_USERNAME")
    [ -z "$MONGO_ROOT_PASSWORD" ] && missing+=("MONGO_ROOT_PASSWORD")

    if [ ${#missing[@]} -gt 0 ]; then
        echo "Error: Missing required secrets: ${missing[*]}"
        return 1
    fi
    return 0
}

# Create secrets file
if validate_secrets; then
    cat > .env.secrets << EOF
MONGO_ROOT_USERNAME=$MONGO_ROOT_USERNAME
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
MONGODB_URI=mongodb://$MONGO_ROOT_USERNAME:$MONGO_ROOT_PASSWORD@mongo:27017/bot_trade?authSource=admin
EOF

    # Add Grafana Cloud secrets if provided
    if [ -n "$GRAFANA_CLOUD_PROMETHEUS_USER" ]; then
        cat >> .env.secrets << EOF
GRAFANA_CLOUD_PROMETHEUS_USER=$GRAFANA_CLOUD_PROMETHEUS_USER
GRAFANA_CLOUD_LOKI_USER=$GRAFANA_CLOUD_LOKI_USER
GRAFANA_CLOUD_API_KEY=$GRAFANA_CLOUD_API_KEY
GRAFANA_CLOUD_PROMETHEUS_URL=$GRAFANA_CLOUD_PROMETHEUS_URL
GRAFANA_CLOUD_LOKI_URL=$GRAFANA_CLOUD_LOKI_URL
EOF
        echo "Grafana Cloud credentials added to .env.secrets"
    fi

    chmod 600 .env.secrets
elif [ ! -f .env.secrets ]; then
    echo "Error: No secrets provided and no existing .env.secrets file!"
    exit 1
else
    echo "Warning: Using existing .env.secrets file"
fi

# Deploy containers
docker compose pull
docker compose down --timeout 30 || true

# ───────────────────────────────────────────────────────────────────
# B2: Deploy ssi-bypass scripts to /opt/bot-trade/scripts/ssi-bypass/
# (systemd cookie-refresh service references this path)
# ───────────────────────────────────────────────────────────────────
if [ -d "$SSI_BYPASS_SRC" ]; then
    install -d -m 755 /opt/bot-trade/scripts/ssi-bypass
    install -m 755 "$SSI_BYPASS_SRC/refresh-cookies.sh" /opt/bot-trade/scripts/ssi-bypass/refresh-cookies.sh
    install -m 755 "$SSI_BYPASS_SRC/verify-bypass.sh"   /opt/bot-trade/scripts/ssi-bypass/verify-bypass.sh
    install -m 644 "$SSI_BYPASS_SRC/README.md"          /opt/bot-trade/scripts/ssi-bypass/README.md
    echo "Installed ssi-bypass scripts to /opt/bot-trade/scripts/ssi-bypass/"
else
    echo "Warning: ssi-bypass source dir not found at $SSI_BYPASS_SRC — skipping" >&2
fi

# ───────────────────────────────────────────────────────────────────
# B3: Install + enable systemd cookie-refresh timer (idempotent)
# ───────────────────────────────────────────────────────────────────
if [ -d "$SSI_BYPASS_SRC/systemd" ]; then
    install -m 644 "$SSI_BYPASS_SRC/systemd/bot-trade-cookie-refresh.service" /etc/systemd/system/bot-trade-cookie-refresh.service
    install -m 644 "$SSI_BYPASS_SRC/systemd/bot-trade-cookie-refresh.timer"   /etc/systemd/system/bot-trade-cookie-refresh.timer
    systemctl daemon-reload
    systemctl enable --now bot-trade-cookie-refresh.timer
    echo "Cookie-refresh timer enabled — next fire: $(systemctl list-timers bot-trade-cookie-refresh.timer --no-pager 2>/dev/null | awk 'NR==2 {print $1, $2, $3, $4}')"
fi

# ───────────────────────────────────────────────────────────────────
# B1: Precondition — /etc/bot-trade/ssi.env must exist with cookies
# (seeded by scripts/vps-setup.sh A2; never created by CI/CD)
# ───────────────────────────────────────────────────────────────────
if [ ! -s /etc/bot-trade/ssi.env ] || ! grep -q '^SSI_CF_CLEARANCE=' /etc/bot-trade/ssi.env; then
    echo "FATAL: /etc/bot-trade/ssi.env missing or invalid." >&2
    echo "  → Run scripts/vps-setup.sh on this VPS first (seeds placeholder ssi.env)." >&2
    exit 1
fi

# ───────────────────────────────────────────────────────────────────
# B4: Bring up the stack with rollback on failure
# ───────────────────────────────────────────────────────────────────
if ! docker compose up -d; then
    echo "FATAL: docker compose up -d failed — attempting rollback to previous compose" >&2
    LATEST_BACKUP=$(ls -1t docker-compose.backup.*.yml 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo "Rolling back to $LATEST_BACKUP" >&2
        cp "$LATEST_BACKUP" docker-compose.yml
        docker compose up -d
    else
        echo "No backup available to roll back to." >&2
    fi
    exit 1
fi

# Wait for services
sleep 10
docker compose ps

echo "Deployment complete!"
