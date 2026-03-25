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
	Name       string                     `bson:"name"`
	Conditions []filtervo.FilterCondition `bson:"filters"`
	Logic      filtervo.FilterLogic       `bson:"logic"`
	Exchanges  []marketvo.Exchange        `bson:"exchanges,omitempty"`
	CreatedAt  time.Time                  `bson:"created_at"`
}
