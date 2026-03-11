// Package valueobject provides immutable value objects for the config domain.
package valueobject

import (
	"time"

	filtervo "bot-trade/domain/shared/valueobject/filter"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// MetricsFilter holds saved screener filter presets for metrics.
// Uses shared kernel FilterCondition for filter conditions to avoid duplication.
type MetricsFilter struct {
	Name       string                     `json:"name" bson:"name"`
	Conditions []filtervo.FilterCondition `json:"filters" bson:"filters"`
	Logic      filtervo.FilterLogic       `json:"logic" bson:"logic"`
	Exchanges  []marketvo.Exchange        `json:"exchanges,omitempty" bson:"exchanges,omitempty"`
	CreatedAt  time.Time                  `json:"created_at" bson:"created_at"`
}
