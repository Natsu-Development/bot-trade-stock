// Package cron provides a cron adapter implementation.
// This package bridges the robfig/cron library with the application's
// CronAdapter interface, keeping cron details in the infrastructure layer.
package cron

import (
	"time"

	"bot-trade/application/port/outbound"

	"github.com/robfig/cron/v3"
)

// Adapter implements outbound.CronAdapter using robfig/cron.
type Adapter struct {
	cron *cron.Cron
}

// NewAdapter creates a new cron adapter with the given timezone.
// If timezone is nil, UTC is used.
func NewAdapter(timezone *time.Location) *Adapter {
	if timezone == nil {
		timezone = time.UTC
	}
	return &Adapter{
		cron: cron.New(cron.WithLocation(timezone)),
	}
}

// AddFunc registers a function to be called on the given cron schedule.
func (a *Adapter) AddFunc(spec string, cmd func()) error {
	_, err := a.cron.AddFunc(spec, cmd)
	return err
}

// Start begins the cron scheduler.
func (a *Adapter) Start() {
	a.cron.Start()
}

// Stop halts the cron scheduler.
func (a *Adapter) Stop() {
	a.cron.Stop()
}

// Ensure Adapter implements CronAdapter.
var _ outbound.CronAdapter = (*Adapter)(nil)
