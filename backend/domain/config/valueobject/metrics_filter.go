// Package valueobject provides immutable value objects for the config domain.
package valueobject

import (
	"time"

	filtervo "backend/domain/shared/valueobject/filter"
)

// MetricsFilter is a saved screener preset: a named, timestamped StockFilter.
// It embeds the flat StockFilter so it marshals natively to BSON with the same
// keys as the wire (match/conditions/groups/exchanges). Stale pre-flat docs
// decode to an empty filter and are skipped on read.
type MetricsFilter struct {
	Name                 string `bson:"name"`
	filtervo.StockFilter `bson:",inline"`
	CreatedAt            time.Time `bson:"created_at"`
}
