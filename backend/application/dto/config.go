// Package dto provides data transfer objects for the application layer.
package dto

import (
	"time"

	configagg "backend/domain/config/aggregate"
	configvo "backend/domain/config/valueobject"
	filtervo "backend/domain/shared/valueobject/filter"
	marketvo "backend/domain/shared/valueobject/market"
)

// TradingConfigRequest is the DTO for creating/updating trading configuration.
type TradingConfigRequest struct {
	ID                  string                `json:"id,omitempty"`
	RSIPeriod           int                   `json:"rsi_period"`
	PivotPeriod         int                   `json:"pivot_period"`
	LookbackDay         int                   `json:"lookback_day"`
	Divergence          ConfigDivergence      `json:"divergence"`
	Trendline           ConfigTrendline       `json:"trendline"`
	IndicesRecent       int                   `json:"indices_recent"`
	SignalDaysThreshold int                   `json:"signal_days_threshold"`
	Telegram            ConfigTelegram        `json:"telegram"`
	MetricsFilter       []ConfigMetricsFilter `json:"metrics_filter,omitempty"`
	Watchlist           []ConfigWatchlistItem `json:"watchlist,omitempty"`
}

// TradingConfigResponse is the DTO for trading configuration responses.
type TradingConfigResponse struct {
	ID                  string                `json:"id"`
	RSIPeriod           int                   `json:"rsi_period"`
	PivotPeriod         int                   `json:"pivot_period"`
	LookbackDay         int                   `json:"lookback_day"`
	Divergence          ConfigDivergence      `json:"divergence"`
	Trendline           ConfigTrendline       `json:"trendline"`
	IndicesRecent       int                   `json:"indices_recent"`
	SignalDaysThreshold int                   `json:"signal_days_threshold"`
	Telegram            ConfigTelegram        `json:"telegram"`
	MetricsFilter       []ConfigMetricsFilter `json:"metrics_filter,omitempty"`
	Watchlist           []ConfigWatchlistItem `json:"watchlist,omitempty"`
	CreatedAt           string                `json:"created_at"`
	UpdatedAt           string                `json:"updated_at"`
}

// ConfigDivergence represents divergence detection parameters for config.
type ConfigDivergence struct {
	RangeMin int `json:"range_min"`
	RangeMax int `json:"range_max"`
}

// ConfigTrendline represents trendline configuration parameters for config.
type ConfigTrendline struct {
	MaxLines         int     `json:"max_lines"`
	ProximityPercent float64 `json:"proximity_percent"`
}

// ConfigTelegram represents Telegram notification settings for config.
type ConfigTelegram struct {
	Enabled  bool   `json:"enabled"`
	BotToken string `json:"bot_token,omitempty"`
	ChatID   string `json:"chat_id,omitempty"`
}

// ConfigMetricsFilter is a saved screener preset on the wire: a named,
// timestamped flat StockFilter (match/conditions/groups/exchanges inline).
type ConfigMetricsFilter struct {
	Name                 string `json:"name"`
	filtervo.StockFilter `json:",inline"`
	CreatedAt            string `json:"created_at"`
}

// ConfigWatchlistItem represents a single stock alert configuration for a symbol.
type ConfigWatchlistItem struct {
	Symbol     string                   `json:"symbol"`
	Conditions []ConfigTriggerCondition `json:"conditions"`
}

// ConfigTriggerCondition represents one alert condition (type + threshold + reference + enabled flag).
type ConfigTriggerCondition struct {
	Type      string  `json:"type"`
	Threshold float64 `json:"threshold"`
	Reference string  `json:"reference,omitempty"`
	Enabled   bool    `json:"enabled"`
}

// ToTradingConfigResponse converts a domain TradingConfig to response DTO.
func ToTradingConfigResponse(cfg *configagg.TradingConfig) *TradingConfigResponse {
	if cfg == nil {
		return nil
	}

	resp := &TradingConfigResponse{
		ID:                  string(cfg.ID),
		RSIPeriod:           int(cfg.RSIPeriod),
		PivotPeriod:         int(cfg.PivotPeriod),
		LookbackDay:         int(cfg.LookbackDay),
		IndicesRecent:       int(cfg.IndicesRecent),
		SignalDaysThreshold: cfg.SignalDaysThreshold,
		Divergence: ConfigDivergence{
			RangeMin: cfg.Divergence.RangeMin,
			RangeMax: cfg.Divergence.RangeMax,
		},
		Trendline: ConfigTrendline{
			MaxLines:         cfg.Trendline.MaxLines,
			ProximityPercent: cfg.Trendline.ProximityPercent,
		},
		Telegram: ConfigTelegram{
			Enabled:  cfg.Telegram.Enabled,
			BotToken: cfg.Telegram.BotToken,
			ChatID:   cfg.Telegram.ChatID,
		},
		CreatedAt: cfg.CreatedAt.Format(time.RFC3339),
		UpdatedAt: cfg.UpdatedAt.Format(time.RFC3339),
	}

	// Convert metrics filters. Skip empty presets: a stale pre-flat doc
	// (old "root"/"combinator", no flat keys) decodes to an empty StockFilter, and
	// surfacing it would present a garbage "return-all" preset to the client
	// (read-side safety net; OPS also $unset the field once at cutover).
	if len(cfg.MetricsFilter) > 0 {
		resp.MetricsFilter = make([]ConfigMetricsFilter, 0, len(cfg.MetricsFilter))
		for _, mf := range cfg.MetricsFilter {
			if mf.IsEmpty() {
				continue
			}
			resp.MetricsFilter = append(resp.MetricsFilter, toConfigMetricsFilter(mf))
		}
	}

	// Convert alerts
	if len(cfg.Watchlist) > 0 {
		resp.Watchlist = make([]ConfigWatchlistItem, len(cfg.Watchlist))
		for i, a := range cfg.Watchlist {
			resp.Watchlist[i] = toConfigWatchlistItem(a)
		}
	}

	return resp
}

// ToTradingConfigAggregate converts a request DTO to domain TradingConfig.
// Returns error if value object validation fails.
func ToTradingConfigAggregate(req TradingConfigRequest) (*configagg.TradingConfig, error) {
	// Create value objects
	rsiPeriod, err := configvo.NewRSIPeriod(req.RSIPeriod)
	if err != nil {
		return nil, err
	}

	pivotPeriod, err := configvo.NewPivotPeriod(req.PivotPeriod)
	if err != nil {
		return nil, err
	}

	lookbackDay, err := marketvo.NewLookbackDay(req.LookbackDay)
	if err != nil {
		return nil, err
	}

	indicesRecent, err := configvo.NewIndicesRecent(req.IndicesRecent)
	if err != nil {
		return nil, err
	}

	divergence := configvo.Divergence{
		RangeMin: req.Divergence.RangeMin,
		RangeMax: req.Divergence.RangeMax,
	}

	trendline := configvo.Trendline{
		MaxLines:         req.Trendline.MaxLines,
		ProximityPercent: req.Trendline.ProximityPercent,
	}

	telegram := configvo.Telegram{
		Enabled:  req.Telegram.Enabled,
		BotToken: req.Telegram.BotToken,
		ChatID:   req.Telegram.ChatID,
	}

	// Convert metrics filters
	// Use MetricsFilter != nil to distinguish between "not provided" (nil) and "explicitly empty" ([]).
	// When user sends metrics_filter: [], it means "clear all filters".
	var metricsFilter []configvo.MetricsFilter
	if req.MetricsFilter != nil && len(req.MetricsFilter) > 0 {
		metricsFilter = make([]configvo.MetricsFilter, len(req.MetricsFilter))
		for i, mf := range req.MetricsFilter {
			converted, err := toConfigMetricsFilterVO(mf)
			if err != nil {
				return nil, err
			}
			metricsFilter[i] = converted
		}
	} else if req.MetricsFilter != nil {
		// Explicitly empty slice means "clear filters"
		metricsFilter = []configvo.MetricsFilter{}
	}

	// Convert alerts
	// Use Alerts != nil to distinguish "not provided" from "explicitly empty"
	// so that sending alerts: [] can clear all alerts.
	var alerts []configvo.WatchlistItem
	if req.Watchlist != nil && len(req.Watchlist) > 0 {
		alerts = make([]configvo.WatchlistItem, len(req.Watchlist))
		for i, a := range req.Watchlist {
			converted, err := toWatchlistItemVO(a)
			if err != nil {
				return nil, err
			}
			alerts[i] = converted
		}
	} else if req.Watchlist != nil {
		alerts = []configvo.WatchlistItem{}
	}

	cfg := &configagg.TradingConfig{
		RSIPeriod:           rsiPeriod,
		PivotPeriod:         pivotPeriod,
		LookbackDay:         lookbackDay,
		Divergence:          divergence,
		Trendline:           trendline,
		IndicesRecent:       indicesRecent,
		SignalDaysThreshold: req.SignalDaysThreshold,
		Telegram:            telegram,
		MetricsFilter:       metricsFilter,
		Watchlist:           alerts,
	}

	// Set ID if provided
	if req.ID != "" {
		configID, err := configvo.NewConfigID(req.ID)
		if err != nil {
			return nil, err
		}
		cfg.ID = configID
	}

	return cfg, nil
}

// toConfigMetricsFilter converts a domain MetricsFilter to its response DTO.
// The flat StockFilter projects natively (match/conditions/groups/exchanges);
// empty presets are skipped by the caller, not here.
func toConfigMetricsFilter(mf configvo.MetricsFilter) ConfigMetricsFilter {
	return ConfigMetricsFilter{
		Name:        mf.Name,
		StockFilter: mf.StockFilter,
		CreatedAt:   mf.CreatedAt.Format(time.RFC3339),
	}
}

// toConfigMetricsFilterVO validates the flat filter and builds a domain MetricsFilter.
func toConfigMetricsFilterVO(dto ConfigMetricsFilter) (configvo.MetricsFilter, error) {
	f := dto.StockFilter
	if err := f.Validate(); err != nil {
		return configvo.MetricsFilter{}, err
	}
	return configvo.MetricsFilter{
		Name:        dto.Name,
		StockFilter: f,
		CreatedAt:   time.Now(),
	}, nil
}

// toConfigWatchlistItem converts a domain WatchlistItem to DTO.
func toConfigWatchlistItem(a configvo.WatchlistItem) ConfigWatchlistItem {
	conditions := make([]ConfigTriggerCondition, len(a.Conditions))
	for i, c := range a.Conditions {
		conditions[i] = ConfigTriggerCondition{
			Type:      string(c.Type),
			Threshold: c.Threshold,
			Reference: c.Reference,
			Enabled:   c.Enabled,
		}
	}
	return ConfigWatchlistItem{
		Symbol:     string(a.Symbol),
		Conditions: conditions,
	}
}

// toWatchlistItemVO converts a DTO to domain WatchlistItem with validation.
func toWatchlistItemVO(dto ConfigWatchlistItem) (configvo.WatchlistItem, error) {
	symbol, err := marketvo.NewSymbol(dto.Symbol)
	if err != nil {
		return configvo.WatchlistItem{}, err
	}

	conditions := make([]configvo.TriggerCondition, len(dto.Conditions))
	for i, c := range dto.Conditions {
		cond, err := configvo.NewTriggerCondition(c.Type, c.Threshold, c.Reference, c.Enabled)
		if err != nil {
			return configvo.WatchlistItem{}, err
		}
		conditions[i] = cond
	}

	return configvo.NewWatchlistItem(symbol, conditions)
}
