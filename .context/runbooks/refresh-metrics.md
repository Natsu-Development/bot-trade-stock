Refresh stock metrics cache (RS Rating data).

## Usage

```bash
# Refresh all stock metrics
curl -X POST http://localhost:8080/stocks/refresh
```

## What It Does

1. Fetches latest price data from VietCap API
2. Calculates RS Rating for all HOSE stocks
3. Updates MongoDB cache
4. Returns cache info

## Check Cache Status

```bash
curl http://localhost:8080/stocks/cache-info
```

## Response

```json
{
  "last_refresh": "2026-03-14T10:00:00Z",
  "stocks_count": 400,
  "exchanges": ["HOSE", "HNX", "UPCOM"]
}
```
