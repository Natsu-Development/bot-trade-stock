package service

import (
	"context"
	"fmt"

	"backend/application/port/outbound"
	configvo "backend/domain/config/valueobject"
)

// ConditionDisabler is the single seam for auto-disabling a fired alert condition.
// Both the tick alert job and the analyze jobs route their disables through here so
// the scoped (no-clobber) write path is one tested place. Identity is
// (configID, symbol, type, reference); for divergence reference == "".
type ConditionDisabler struct {
	repo outbound.ConfigRepository
}

// NewConditionDisabler constructs a ConditionDisabler over the config repository.
func NewConditionDisabler(repo outbound.ConfigRepository) *ConditionDisabler {
	return &ConditionDisabler{repo: repo}
}

// Disable sets the matching condition's enabled flag to false via the scoped
// per-condition update, never a whole-doc write.
func (d *ConditionDisabler) Disable(ctx context.Context, configID, symbol string, cond configvo.AlertCondition) error {
	if err := d.repo.SetConditionEnabled(ctx, configID, symbol, cond, false); err != nil {
		return fmt.Errorf("disable condition %s for %s: %w", cond.Type, symbol, err)
	}
	return nil
}
