// Package dto provides data transfer objects for the application layer.
package dto

import (
	"fmt"
	"time"

	configagg "bot-trade/domain/config/aggregate"
	configvo "bot-trade/domain/config/valueobject"
	filtervo "bot-trade/domain/shared/valueobject/filter"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// TradingConfigRequest is the DTO for creating/updating trading configuration.
type TradingConfigRequest struct {
	ID             string                 `json:"id,omitempty"`
	RSIPeriod      int                    `json:"rsi_period"`
	PivotPeriod    int                    `json:"pivot_period"`
	LookbackDay    int                    `json:"lookback_day"`
	Divergence     ConfigDivergence       `json:"divergence"`
	Trendline      ConfigTrendline        `json:"trendline"`
	IndicesRecent  int                    `json:"indices_recent"`
	BearishEarly   *bool                  `json:"bearish_early,omitempty"`
	BearishSymbols []string               `json:"bearish_symbols"`
	BullishSymbols []string               `json:"bullish_symbols"`
	Telegram       ConfigTelegram         `json:"telegram"`
	MetricsFilter  []ConfigMetricsFilter  `json:"metrics_filter,omitempty"`
}

// TradingConfigResponse is the DTO for trading configuration responses.
type TradingConfigResponse struct {
	ID             string                 `json:"id"`
	RSIPeriod      int                    `json:"rsi_period"`
	PivotPeriod    int                    `json:"pivot_period"`
	LookbackDay    int                    `json:"lookback_day"`
	Divergence     ConfigDivergence       `json:"divergence"`
	Trendline      ConfigTrendline        `json:"trendline"`
	IndicesRecent  int                    `json:"indices_recent"`
	BearishEarly   *bool                  `json:"bearish_early,omitempty"`
	BearishSymbols []string               `json:"bearish_symbols"`
	BullishSymbols []string               `json:"bullish_symbols"`
	Telegram       ConfigTelegram         `json:"telegram"`
	MetricsFilter  []ConfigMetricsFilter  `json:"metrics_filter,omitempty"`
	CreatedAt      string                 `json:"created_at"`
	UpdatedAt      string                 `json:"updated_at"`
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

// ConfigMetricsFilter represents saved screener filter presets for config.
type ConfigMetricsFilter struct {
	Name       string                   `json:"name"`
	Conditions []ConfigFilterCondition  `json:"filters"`
	Logic      string                   `json:"logic"`
	Exchanges  []string                 `json:"exchanges,omitempty"`
	CreatedAt  string                   `json:"created_at"`
}

// ConfigFilterCondition represents a single filter condition for config.
// Value accepts number or boolean (converted to 0/1 for boolean fields).
type ConfigFilterCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"op"`
	Value    interface{} `json:"value,omitempty"`
}

// ToFilterCondition converts DTO to domain FilterCondition.
// Converts boolean values to 0/1 for storage.
func (c ConfigFilterCondition) ToFilterCondition() (filtervo.FilterCondition, error) {
	// Validate field and operator
	_, err := filtervo.NewFilterField(c.Field)
	if err != nil {
		return filtervo.FilterCondition{}, err
	}

	_, err = filtervo.NewFilterOperator(c.Operator)
	if err != nil {
		return filtervo.FilterCondition{}, err
	}

	// Convert any value to float64
	var numVal float64
	switch v := c.Value.(type) {
	case bool:
		if v {
			numVal = 1 // true → 1
		} else {
			numVal = 0 // false → 0
		}
	case float64:
		numVal = v
	case int:
		numVal = float64(v)
	default:
		return filtervo.FilterCondition{}, fmt.Errorf("invalid value type for field %s", c.Field)
	}

	return filtervo.NewFilterCondition(c.Field, c.Operator, numVal)
}

// ToTradingConfigResponse converts a domain TradingConfig to response DTO.
func ToTradingConfigResponse(cfg *configagg.TradingConfig) *TradingConfigResponse {
	if cfg == nil {
		return nil
	}

	resp := &TradingConfigResponse{
		ID:            string(cfg.ID),
		RSIPeriod:     int(cfg.RSIPeriod),
		PivotPeriod:   int(cfg.PivotPeriod),
		LookbackDay:   int(cfg.LookbackDay),
		IndicesRecent: int(cfg.IndicesRecent),
		BearishEarly:  cfg.BearishEarly,
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

	// Convert symbols
	resp.BearishSymbols = make([]string, len(cfg.BearishSymbols))
	for i, s := range cfg.BearishSymbols {
		resp.BearishSymbols[i] = string(s)
	}
	resp.BullishSymbols = make([]string, len(cfg.BullishSymbols))
	for i, s := range cfg.BullishSymbols {
		resp.BullishSymbols[i] = string(s)
	}

	// Convert metrics filters
	if len(cfg.MetricsFilter) > 0 {
		resp.MetricsFilter = make([]ConfigMetricsFilter, len(cfg.MetricsFilter))
		for i, mf := range cfg.MetricsFilter {
			resp.MetricsFilter[i] = toConfigMetricsFilter(mf)
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

	// Convert symbols
	bearishSymbols := make([]marketvo.Symbol, len(req.BearishSymbols))
	for i, s := range req.BearishSymbols {
		symbol, err := marketvo.NewSymbol(s)
		if err != nil {
			return nil, err
		}
		bearishSymbols[i] = symbol
	}

	bullishSymbols := make([]marketvo.Symbol, len(req.BullishSymbols))
	for i, s := range req.BullishSymbols {
		symbol, err := marketvo.NewSymbol(s)
		if err != nil {
			return nil, err
		}
		bullishSymbols[i] = symbol
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

	cfg := &configagg.TradingConfig{
		RSIPeriod:      rsiPeriod,
		PivotPeriod:    pivotPeriod,
		LookbackDay:    lookbackDay,
		Divergence:     divergence,
		Trendline:      trendline,
		IndicesRecent:  indicesRecent,
		BearishEarly:   req.BearishEarly,
		BearishSymbols: bearishSymbols,
		BullishSymbols: bullishSymbols,
		Telegram:       telegram,
		MetricsFilter:  metricsFilter,
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

// toConfigMetricsFilter converts a domain MetricsFilter to DTO.
func toConfigMetricsFilter(mf configvo.MetricsFilter) ConfigMetricsFilter {
	dto := ConfigMetricsFilter{
		Name:      mf.Name,
		Logic:     string(mf.Logic),
		CreatedAt: mf.CreatedAt.Format(time.RFC3339),
	}

	dto.Conditions = make([]ConfigFilterCondition, len(mf.Conditions))
	for i, c := range mf.Conditions {
		// For response, convert back to bool for signal fields
		if c.IsBooleanField() {
			dto.Conditions[i] = ConfigFilterCondition{
				Field:    string(c.Field),
				Operator: string(c.Operator),
				Value:    c.GetBoolValue(), // Returns true/false for JSON
			}
		} else {
			dto.Conditions[i] = ConfigFilterCondition{
				Field:    string(c.Field),
				Operator: string(c.Operator),
				Value:    c.Value,
			}
		}
	}

	dto.Exchanges = make([]string, len(mf.Exchanges))
	for i, e := range mf.Exchanges {
		dto.Exchanges[i] = string(e)
	}

	return dto
}

// toConfigMetricsFilterVO converts a DTO to domain MetricsFilter.
func toConfigMetricsFilterVO(dto ConfigMetricsFilter) (configvo.MetricsFilter, error) {
	logic, err := filtervo.Validate(dto.Logic)
	if err != nil {
		return configvo.MetricsFilter{}, err
	}

	conditions := make([]filtervo.FilterCondition, len(dto.Conditions))
	for i, c := range dto.Conditions {
		condition, err := c.ToFilterCondition()
		if err != nil {
			return configvo.MetricsFilter{}, err
		}
		conditions[i] = condition
	}

	exchanges := make([]marketvo.Exchange, len(dto.Exchanges))
	for i, e := range dto.Exchanges {
		exchange, err := marketvo.NewExchange(e)
		if err != nil {
			return configvo.MetricsFilter{}, err
		}
		exchanges[i] = exchange
	}

	return configvo.MetricsFilter{
		Name:       dto.Name,
		Conditions: conditions,
		Logic:      logic,
		Exchanges:  exchanges,
		CreatedAt:  time.Now(),
	}, nil
}