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

# Filter stocks with screener
curl -X POST http://localhost:8080/stocks/filter \
  -H "Content-Type: application/json" \
  -d '{"filters": [{"field": "rs_rating", "operator": "gte", "value": 80}]}'

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
