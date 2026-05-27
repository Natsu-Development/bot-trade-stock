---
name: trading-domain
description: Use when implementing or reviewing trading-domain behavior: RSI divergence, trendlines, RS Rating, alerts, stock metrics, Vietnamese exchange symbols, and signal notification logic.
---

# Trading Domain Knowledge

Domain-specific knowledge for RSI divergence detection, trendline analysis, and stock metrics.

## RSI Divergence Detection

### What is Divergence?

Divergence occurs when price action and RSI indicator move in opposite directions.

**Bullish Divergence:**
- Price makes lower lows
- RSI makes higher lows
- Signal: Potential reversal upward

**Bearish Divergence:**
- Price makes higher highs
- RSI makes lower highs
- Signal: Potential reversal downward

### Detection Algorithm

1. Find pivot points in price data (local highs/lows)
2. Find pivot points in RSI data
3. Match price pivots with RSI pivots
4. Compare directions:
   - Price down + RSI up = Bullish divergence
   - Price up + RSI down = Bearish divergence

### Key Parameters

```go
const (
    RSI_PERIOD     = 14     // RSI calculation period
    RSI_OVERBOUGHT = 70     // Overbought threshold
    RSI_OVERSOLD   = 30     // Oversold threshold
    PIVOT_STRENGTH = 5      // Pivot detection strength
)
```

### Code Location

- Domain service: `domain/service/divergence/`
- Use case: `application/usecase/analyze_divergence.go`

## Trendline Analysis

### What are Trendlines?

Lines connecting pivot points to identify support/resistance levels.

**Support Line:** Connects higher lows in uptrend
**Resistance Line:** Connects lower highs in downtrend

### Signals

- **Bounce:** Price touches trendline and reverses
- **Breakout:** Price breaks through trendline
- **Pullback:** Price returns to test broken trendline

### Code Location

- Domain service: `domain/service/trendline/`
- Use case: `application/usecase/analyze_trendline.go`

## RS Rating (Relative Strength)

### What is RS Rating?

Compares a stock's price performance against the market average.

### Calculation

1. Calculate price change % for each stock over period (1M, 3M, 6M, 9M, 12M)
2. Rank all stocks by performance
3. Convert to percentile (0-100)
4. Higher RS = stronger relative performance

### Usage in Screener

```typescript
// Filter stocks with RS Rating >= 80
{
  field: "rs_rating",
  operator: "gte",
  value: 80
}
```

### Code Location

- Domain service: `domain/service/stockmetrics/`
- Use case: `application/usecase/stock_metrics.go`

## Vietnamese Stock Market

### Exchanges

- **HOSE**: Ho Chi Minh City Stock Exchange (largest)
- **HNX**: Hanoi Stock Exchange
- **UPCOM**: Unlisted Public Company Market

### Common Symbols

- VIC - Vingroup
- VCB - Vietcombank
- BID - BIDV
- CTG - VietinBank
- TCB - Techcombank
- FPT - FPT Corporation
- MWG - Mobile World

### Data Source

VietCap API provides:
- Real-time price data
- Historical OHLCV data
- Stock information

## Analysis Flow

```
1. Fetch price data from VietCap API
2. Calculate RSI indicator
3. Detect pivot points
4. Find divergence patterns
5. Detect trendlines
6. Generate signals
7. Send to Telegram if patterns found
```

## Notification Rules

- Bullish divergence → Buy signal alert
- Bearish divergence → Sell signal alert
- Trendline break → Breakout alert
- Multiple signals → Combined alert
