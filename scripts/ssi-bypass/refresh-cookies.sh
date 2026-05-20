#!/usr/bin/env bash
# Refreshes SSI Cloudflare cookies via a running FlareSolverr instance.
# Prints cookies in three formats and (optionally) writes them to an env
# file the Go bot can source.
#
# Prereq: FlareSolverr container already running at $FLARESOLVERR_URL.
#         Brought up by `docker compose -f docker/docker-compose.prod.yml up -d flaresolverr`.
#
# Usage:
#   ./refresh-cookies.sh                                          # print to stdout only
#   ./refresh-cookies.sh /etc/bot-trade/ssi.env --reload-target=none    # write env file, no signal
#   ./refresh-cookies.sh /etc/bot-trade/ssi.env --reload-target=docker  # write + SIGHUP container
#   ./refresh-cookies.sh /etc/bot-trade/ssi.env --reload-target=systemd # write + SIGHUP systemd unit
#
#   RELOAD_TARGET env var is also accepted; --reload-target= flag wins if both are set.
#   DOCKER_BOT_CONTAINER must be set when --reload-target=docker.
#
# Exit codes:
#   0 = fresh cookies obtained (and env file written + signal sent, when requested)
#   1 = FlareSolverr unreachable
#   2 = Cloudflare did not yield cf_clearance
#   3 = invalid / missing --reload-target
set -euo pipefail

: "${FLARESOLVERR_URL:=http://127.0.0.1:8191/v1}"
: "${SEED_URL:=https://iboard.ssi.com.vn/}"
: "${MAX_TIMEOUT_MS:=300000}"

# --- argument parsing -------------------------------------------------------
ENV_OUT=""
FLAG_RELOAD_TARGET=""

for arg in "$@"; do
  case "$arg" in
    --reload-target=*)
      FLAG_RELOAD_TARGET="${arg#--reload-target=}"
      ;;
    -*)
      echo "ERROR: unknown flag: $arg" >&2
      exit 3
      ;;
    *)
      if [ -z "$ENV_OUT" ]; then
        ENV_OUT="$arg"
      else
        echo "ERROR: unexpected positional argument: $arg" >&2
        exit 3
      fi
      ;;
  esac
done

# flag wins over env var
RELOAD_TARGET="${FLAG_RELOAD_TARGET:-${RELOAD_TARGET:-}}"

# validate reload target when an env file will be written
if [ -n "$ENV_OUT" ]; then
  case "$RELOAD_TARGET" in
    systemd|docker|none) ;;
    "")
      echo "ERROR: --reload-target=<systemd|docker|none> is required when writing an env file (or set RELOAD_TARGET)" >&2
      exit 3
      ;;
    *)
      echo "ERROR: unknown --reload-target value: '$RELOAD_TARGET' (must be systemd, docker, or none)" >&2
      exit 3
      ;;
  esac
fi

# --- sanity: FlareSolverr reachable -----------------------------------------
health_url="${FLARESOLVERR_URL%/v1}/health"
if ! curl -fsS "$health_url" >/dev/null 2>&1; then
  echo "ERROR: FlareSolverr not reachable at $FLARESOLVERR_URL" >&2
  echo "Start it with: docker compose -f docker/docker-compose.prod.yml up -d flaresolverr" >&2
  exit 1
fi

# --- solve ------------------------------------------------------------------
payload=$(jq -nc \
  --arg url "$SEED_URL" \
  --argjson t "$MAX_TIMEOUT_MS" \
  '{cmd:"request.get", url:$url, maxTimeout:$t}')

resp=$(curl -sS -X POST "$FLARESOLVERR_URL" \
  -H 'Content-Type: application/json' --data-binary "$payload")

if [ "$(printf '%s' "$resp" | jq -r '.status')" != "ok" ]; then
  echo "ERROR: FlareSolverr failed to solve" >&2
  printf '%s' "$resp" | jq -r '.message // .' >&2
  exit 2
fi

cookies_json=$(printf '%s' "$resp" | jq '.solution.cookies')
ua=$(printf '%s' "$resp" | jq -r '.solution.userAgent')

cf_clearance=$(printf '%s' "$cookies_json" | jq -r 'map(select(.name=="cf_clearance"))[0].value // empty')
cf_bm=$(printf       '%s' "$cookies_json" | jq -r 'map(select(.name=="__cf_bm"))[0].value      // empty')
cfuvid=$(printf      '%s' "$cookies_json" | jq -r 'map(select(.name=="_cfuvid"))[0].value      // empty')

if [ -z "$cf_clearance" ]; then
  echo "ERROR: no cf_clearance in returned cookies" >&2
  printf '%s\n' "$cookies_json" >&2
  exit 2
fi

# --- output -----------------------------------------------------------------
echo "========================================================================"
echo "FRESH SSI COOKIES  (minted $(date -Iseconds))"
echo "========================================================================"
echo
echo "User-Agent:"
echo "  $ua"
echo
echo "cf_clearance:"
echo "  $cf_clearance"
echo
echo "__cf_bm:"
echo "  ${cf_bm:-<not set>}"
echo
echo "_cfuvid:"
echo "  ${cfuvid:-<not set>}"
echo
echo "------------------------------------------------------------------------"
echo "As a single Cookie header (drop-in for curl -H 'Cookie: ...'):"
echo "------------------------------------------------------------------------"
pairs="cf_clearance=$cf_clearance"
[ -n "$cf_bm" ]   && pairs="$pairs; __cf_bm=$cf_bm"
[ -n "$cfuvid" ] && pairs="$pairs; _cfuvid=$cfuvid"
echo "$pairs"
echo
echo "------------------------------------------------------------------------"
echo "As env vars (source into Go bot / systemd EnvironmentFile):"
echo "------------------------------------------------------------------------"
# RFC3339 with colon-form offset (e.g. 2026-05-18T08:50:00+00:00) so Go's
# time.RFC3339 parser accepts it. The non-colon `%z` form (e.g. +0000) is
# rejected by time.Parse(time.RFC3339, ...).
minted_at="$(date -u -Iseconds)"
env_block=$(cat <<EOF
SSI_USER_AGENT="$ua"
SSI_CF_CLEARANCE="$cf_clearance"
SSI_CF_BM="$cf_bm"
SSI_CF_UVID="$cfuvid"
SSI_COOKIES_MINTED_AT="$minted_at"
EOF
)
echo "$env_block"

# --- atomic env file write + reload signal ----------------------------------
if [ -n "$ENV_OUT" ]; then
  umask 077
  tmp="${ENV_OUT}.tmp.$$"
  printf '%s\n' "$env_block" > "$tmp"
  mv "$tmp" "$ENV_OUT"

  # chown to bot user if it exists (skip with warning in local dev)
  if id -u bot-trade >/dev/null 2>&1; then
    chown bot-trade:bot-trade "$ENV_OUT"
  else
    echo "WARNING: user 'bot-trade' not found; skipping chown (OK for local dev)" >&2
  fi

  echo
  echo "==> wrote env file: $ENV_OUT (mode 600)"

  # dispatch reload signal
  case "$RELOAD_TARGET" in
    systemd)
      systemctl kill -s HUP bot-trade.service
      echo "==> sent SIGHUP to bot-trade.service"
      ;;
    docker)
      : "${DOCKER_BOT_CONTAINER:?DOCKER_BOT_CONTAINER must be set for --reload-target=docker}"
      docker kill -s HUP "$DOCKER_BOT_CONTAINER"
      echo "==> sent SIGHUP to container: $DOCKER_BOT_CONTAINER"
      ;;
    none)
      echo "==> reload-target=none; no signal sent"
      ;;
  esac
fi
