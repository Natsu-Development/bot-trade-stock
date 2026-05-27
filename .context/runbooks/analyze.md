Run divergence and trendline analysis for a stock symbol.

## Usage

```bash
# Analyze a specific symbol
curl http://localhost:8080/analyze/{SYMBOL}
```

## Examples

```bash
# Analyze VIC (Vingroup)
curl http://localhost:8080/analyze/VIC

# Analyze VCB (Vietcombank)
curl http://localhost:8080/analyze/VCB
```

## Response

Returns unified analysis including:
- Divergence patterns (bullish/bearish)
- Trendline signals (support/resistance breakouts)
- RSI indicator values
- Price data points
