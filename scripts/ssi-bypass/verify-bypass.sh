#!/usr/bin/env bash
# Atomic verifier: mint fresh SSI cookies via FlareSolverr, then immediately
# curl the real bot endpoint in the same shell. No copy/paste, no UA drift,
# no multi-line cookie bugs. Prints PASS/FAIL.
#
# Prereq: FlareSolverr running at 127.0.0.1:8191.
# Usage:  bash verify-bypass.sh
set -euo pipefail

: "${FLARESOLVERR_URL:=http://127.0.0.1:8191/v1}"
: "${SEED_URL:=https://iboard.ssi.com.vn/}"
: "${TARGET_URL:=https://iboard-query.ssi.com.vn/stock/group/HOSE}"
: "${MAX_TIMEOUT_MS:=150000}"

echo "==> mint fresh cookies via FlareSolverr"
resp=$(curl -fsS -X POST "$FLARESOLVERR_URL" \
  -H 'Content-Type: application/json' \
  --data-binary "$(jq -nc \
      --arg url "$SEED_URL" \
      --argjson t "$MAX_TIMEOUT_MS" \
      '{cmd:"request.get", url:$url, maxTimeout:$t}')")

if [ "$(jq -r '.status' <<<"$resp")" != "ok" ]; then
  echo "FAIL: FlareSolverr did not solve"
  jq -r '.message // .' <<<"$resp"
  exit 1
fi

ua=$(jq -r '.solution.userAgent' <<<"$resp")
cf_clearance=$(jq -r '.solution.cookies | map(select(.name=="cf_clearance"))[0].value // empty' <<<"$resp")
cf_bm=$(jq       -r '.solution.cookies | map(select(.name=="__cf_bm"))[0].value      // empty' <<<"$resp")
cfuvid=$(jq      -r '.solution.cookies | map(select(.name=="_cfuvid"))[0].value      // empty' <<<"$resp")

if [ -z "$cf_clearance" ]; then
  echo "FAIL: no cf_clearance returned"
  exit 1
fi

# Build cookie header as ONE string — no embedded newlines.
cookie="cf_clearance=$cf_clearance"
[ -n "$cf_bm" ]  && cookie="$cookie; __cf_bm=$cf_bm"
[ -n "$cfuvid" ] && cookie="$cookie; _cfuvid=$cfuvid"

echo "    UA used : $ua"
echo "    cookie length: ${#cookie} bytes"
echo

echo "==> curl $TARGET_URL with those cookies (same UA, same shell)"
body_file=$(mktemp)
status=$(curl -sS -o "$body_file" -w '%{http_code}' \
  -H "User-Agent: $ua" \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H "Cookie: $cookie" \
  "$TARGET_URL")

bytes=$(wc -c <"$body_file")
echo "    HTTP    : $status"
echo "    bytes   : $bytes"
echo "    preview :"
head -c 200 "$body_file" | sed 's/^/      /'
echo
echo

if [ "$status" = "200" ] && head -c 1 "$body_file" | grep -qE '^[{[]'; then
  echo "PASS: real JSON payload returned — bypass works end-to-end from this VPS."
  rm -f "$body_file"
  exit 0
fi

echo "FAIL: got status=$status (challenge body saved at $body_file)"
exit 2
