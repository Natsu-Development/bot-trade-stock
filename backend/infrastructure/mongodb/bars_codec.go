package mongodb

import (
	"bytes"
	"compress/gzip"
	"encoding/gob"
	"fmt"

	marketvo "backend/domain/shared/valueobject/market"
)

// barsCodecVersion identifies the on-disk encoding of the stock_bars blob. It is
// stored in the document's `codec` field so a future format change is detected on
// read: an unknown codec is treated as "no usable bars" rather than fed to a
// decoder that would mis-read it.
const barsCodecVersion = "gob+gzip/v1"

// encodeBars serializes the per-symbol raw-bar map into a compact, compressed blob:
// gob (compact binary for the homogeneous map[string][]MarketData) wrapped in gzip.
// The bars are the raw OHLCV series Layer 2 recomputes per-config signals from; the
// blob is opaque storage (never queried by field), so a binary codec is fine.
func encodeBars(bars map[string][]marketvo.MarketData) ([]byte, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if err := gob.NewEncoder(gz).Encode(bars); err != nil {
		_ = gz.Close()
		return nil, fmt.Errorf("gob-encode bars: %w", err)
	}
	if err := gz.Close(); err != nil {
		return nil, fmt.Errorf("flush gzip bars: %w", err)
	}
	return buf.Bytes(), nil
}

// decodeBars reverses encodeBars (gunzip then gob-decode). It returns an error —
// never panics — on truncated or corrupt input so callers can fall back to "no
// bars" (today's empty-until-cron behavior) instead of crashing on boot.
func decodeBars(blob []byte) (map[string][]marketvo.MarketData, error) {
	gz, err := gzip.NewReader(bytes.NewReader(blob))
	if err != nil {
		return nil, fmt.Errorf("open gzip bars: %w", err)
	}
	defer func() { _ = gz.Close() }()

	var bars map[string][]marketvo.MarketData
	if err := gob.NewDecoder(gz).Decode(&bars); err != nil {
		return nil, fmt.Errorf("gob-decode bars: %w", err)
	}
	return bars, nil
}
