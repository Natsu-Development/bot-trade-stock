Test API endpoints to verify the system is working.

## Quick Test

```bash
# Using make
make docker-test

# Or test manually
```

## Health Check

```bash
curl http://localhost:8080/health
```

## Core Endpoints

```bash
# Get config
curl http://localhost:8080/config/{ID}

# Analyze stock
curl http://localhost:8080/analyze/VIC

# Filter stocks with screener (flat normal form; config_id REQUIRED — signals are per-config).
# Body: {match, negate?, conditions[], groups[], exchanges[]}
#   condition = {field, op, value}        number/signal compare
#             | {field, op, rhs_field}    field-vs-field (MA/price), op in {>,<}, no value
#   group     = {match, negate?, conditions[]}   one level only (no sub-groups)
# Operators by field kind:
#   integer (rs_1m..rs_52w, current_volume, volume_sma20)    -> >, >=, <, <=
#   float   (current_price, price_change_pct, volume_vs_sma) -> >, <
#   signal  (has_breakout_potential/confirmed, has_breakdown_potential/confirmed,
#            has_bullish_rsi, has_bearish_rsi)               -> "=" with value true/false
#   moving average (ema_9, ema_21, ema_50, sma_200)          -> compare via rhs_field
# match/group combinator: "and" | "or". Exchanges (outer AND): HOSE, HNX, UPCOM.
# An empty body returns all stocks.
curl -X POST "http://localhost:8080/stocks/filter?config_id=<id>" \
  -H "Content-Type: application/json" \
  -d '{"match":"and","conditions":[{"field":"rs_52w","op":">=","value":80},{"field":"ema_9","op":">","rhs_field":"ema_21"}],"groups":[{"match":"or","conditions":[{"field":"has_breakout_confirmed","op":"=","value":true}]}],"exchanges":["HOSE"]}'

# Recompute per-config signals (no fetch; config_id required)
curl -X POST "http://localhost:8080/stocks/recompute?config_id=<id>"

# Cache info
curl http://localhost:8080/stocks/cache-info
```

## Expected Responses

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
