#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# One-time VPS bootstrap for the trading stack
# ═══════════════════════════════════════════════════════════════════

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARE_CERT_DIR="${CLOUDFLARE_CERT_DIR:-$SCRIPT_DIR/../secrets/cloudflare}"

echo "════════════════════════════════════════════════════"
echo "  VPS Bootstrap"
echo "════════════════════════════════════════════════════"

# ───────────────────────────────────────────────────────────────────
# Step 1: System updates
# ───────────────────────────────────────────────────────────────────
echo "[1/8] Updating system..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg lsb-release jq

# ───────────────────────────────────────────────────────────────────
# Step 2: Install Docker
# ───────────────────────────────────────────────────────────────────
echo "[2/8] Installing Docker..."
if ! command -v docker >/dev/null 2>&1; then
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    cat > /usr/local/bin/docker-compose << 'EOF'
#!/bin/bash
docker compose "$@"
EOF
    chmod +x /usr/local/bin/docker-compose
fi
echo "    Docker: $(docker --version)"

# ───────────────────────────────────────────────────────────────────
# Step 3 (A1): Docker daemon — DNS fallbacks + registry mirrors
# Prevents intermittent `lookup ghcr.io on 8.8.8.8:53: no such host`
# during `docker compose pull`. Skip if operator has a custom daemon.json.
# ───────────────────────────────────────────────────────────────────
echo "[3/8] Configuring Docker daemon DNS..."
if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ],
  "dns": ["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"],
  "dns-opts": ["timeout:2", "attempts:3"]
}
EOF
    systemctl reload docker
    echo "    /etc/docker/daemon.json created (DNS fallbacks + registry mirrors)"
else
    echo "    /etc/docker/daemon.json already exists — leaving as-is"
fi

# ───────────────────────────────────────────────────────────────────
# Step 4 (A2): bot-trade user, dirs, placeholder ssi.env
#
# The bot fail-fasts at startup (env_store.go:75-81, 141-144) if
# /etc/bot-trade/ssi.env is missing or has empty required keys. Seed a
# placeholder that passes validation; the systemd cookie-refresh timer
# replaces it with real cookies at 08:50 ICT each trading day (or
# `systemctl start bot-trade-cookie-refresh.service` triggers it now).
# ───────────────────────────────────────────────────────────────────
echo "[4/8] Creating bot-trade user, dirs, placeholder ssi.env..."
if ! id -u bot-trade >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin bot-trade
fi
mkdir -p /opt/bot-trade/scripts/ssi-bypass
mkdir -p /etc/bot-trade
mkdir -p /etc/ssl/cloudflare
chown -R bot-trade:bot-trade /etc/bot-trade
chmod 750 /etc/bot-trade

if [ ! -s /etc/bot-trade/ssi.env ]; then
    cat > /etc/bot-trade/ssi.env <<'EOF'
SSI_USER_AGENT="Mozilla/5.0 (bootstrap)"
SSI_CF_CLEARANCE="bootstrap-placeholder-replace-on-next-timer-fire"
SSI_CF_BM="bootstrap-placeholder"
SSI_CF_UVID=""
SSI_COOKIES_MINTED_AT="1970-01-01T00:00:00+00:00"
EOF
    chown bot-trade:bot-trade /etc/bot-trade/ssi.env
    chmod 600 /etc/bot-trade/ssi.env
    echo "    /etc/bot-trade/ssi.env seeded with placeholder (timer will replace)"
else
    echo "    /etc/bot-trade/ssi.env already exists — leaving as-is"
fi

# ───────────────────────────────────────────────────────────────────
# Step 5 (A3): SSH hardening — one-time, gated by marker file
# Marker preserves operator edits on subsequent re-runs.
# ───────────────────────────────────────────────────────────────────
echo "[5/8] Hardening SSH..."
if [ -f /etc/.trading-vps-hardened ]; then
    echo "    SSH already hardened (marker /etc/.trading-vps-hardened present)"
else
    BACKUP_SUFFIX=".bak.$(date +%s)"
    cp -a /etc/ssh/sshd_config "/etc/ssh/sshd_config${BACKUP_SUFFIX}"
    if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
        cp -a /etc/ssh/sshd_config.d/50-cloud-init.conf "/etc/ssh/sshd_config.d/50-cloud-init.conf${BACKUP_SUFFIX}"
    fi

    sed -i -E 's/^#?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
    sed -i -E 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    if grep -q '^KbdInteractiveAuthentication' /etc/ssh/sshd_config; then
        sed -i -E 's/^KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
    else
        echo 'KbdInteractiveAuthentication no' >> /etc/ssh/sshd_config
    fi
    if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
        sed -i -E 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
    fi

    if ! sshd -t; then
        echo "ERROR: sshd config invalid — reverting backup" >&2
        cp -a "/etc/ssh/sshd_config${BACKUP_SUFFIX}" /etc/ssh/sshd_config
        exit 1
    fi
    systemctl reload ssh
    touch /etc/.trading-vps-hardened
    echo "    SSH hardened (PermitRootLogin prohibit-password, PasswordAuthentication no)"
fi

# ───────────────────────────────────────────────────────────────────
# Step 6 (A4): fail2ban + iptables-persistent
# ───────────────────────────────────────────────────────────────────
echo "[6/8] Installing fail2ban + iptables-persistent..."
DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban iptables-persistent
if [ ! -f /etc/fail2ban/jail.local ]; then
    cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 24h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
EOF
fi
systemctl enable --now fail2ban

# ───────────────────────────────────────────────────────────────────
# Step 7 (A5): Install Cloudflare Origin CA certs from local source
# Operator stages certs at $CLOUDFLARE_CERT_DIR (default: <repo>/secrets/cloudflare).
# ───────────────────────────────────────────────────────────────────
echo "[7/8] Installing Cloudflare Origin CA certs..."
if [ -f "$CLOUDFLARE_CERT_DIR/cert.pem" ] && [ -f "$CLOUDFLARE_CERT_DIR/key.pem" ]; then
    install -d -m 700 -o root -g root /etc/ssl/cloudflare
    install -m 644 -o root -g root "$CLOUDFLARE_CERT_DIR/cert.pem" /etc/ssl/cloudflare/cert.pem
    install -m 600 -o root -g root "$CLOUDFLARE_CERT_DIR/key.pem" /etc/ssl/cloudflare/key.pem
    echo "    Certs installed from $CLOUDFLARE_CERT_DIR"
elif [ -f /etc/ssl/cloudflare/cert.pem ] && [ -f /etc/ssl/cloudflare/key.pem ]; then
    echo "    /etc/ssl/cloudflare/ already has certs — leaving as-is"
else
    echo "    WARNING: no certs at $CLOUDFLARE_CERT_DIR and none on the VPS." >&2
    echo "             trading-nginx will fail to start until cert.pem + key.pem" >&2
    echo "             are placed in /etc/ssl/cloudflare/." >&2
    echo "             To stage: scp secrets/cloudflare/{cert,key}.pem alongside scripts/" >&2
    echo "             then re-run: CLOUDFLARE_CERT_DIR=cloudflare bash scripts/vps-setup.sh" >&2
fi

# ───────────────────────────────────────────────────────────────────
# Step 8: Deployment directory
# ───────────────────────────────────────────────────────────────────
echo "[8/8] Creating deployment directory..."
mkdir -p /opt/trading-app/logs
echo "    /opt/trading-app/ ready"

echo ""
echo "════════════════════════════════════════════════════"
echo "  Bootstrap complete"
echo "════════════════════════════════════════════════════"
echo ""
echo "Next: push to master (or re-run GitHub Actions workflow) to trigger deploy."
echo "      The deploy job installs the systemd cookie-refresh timer and brings"
echo "      up the stack via docker compose."
