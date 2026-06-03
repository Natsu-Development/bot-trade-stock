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

# Filter stocks with screener (react-querybuilder tree-only schema).
# Body: a recursive FilterNode under "root" + optional outer-AND "exchanges".
#   rule  = {field, operator, value}
#   group = {"combinator":"and"|"or","not"?:bool,"rules":[...]}
# Fields: rs_1m, rs_3m, rs_6m, rs_9m, rs_52w, volume_vs_sma, current_volume,
#         volume_sma20, and signal (boolean) fields. Operators: >=, <=, >, <, =
#   (signal fields use operator "=" with value true/false).
# Exchanges: HOSE, HNX, UPCOM. An empty root returns all stocks.
curl -X POST http://localhost:8080/stocks/filter \
  -H "Content-Type: application/json" \
  -d '{"root": {"combinator": "and", "rules": [{"field": "rs_52w", "operator": ">=", "value": 80}]}, "exchanges": ["HOSE"]}'

# Refresh metrics
curl -X POST http://localhost:8080/stocks/refresh

# Cache info
curl http://localhost:8080/stocks/cache-info
```

## Expected Responses

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
