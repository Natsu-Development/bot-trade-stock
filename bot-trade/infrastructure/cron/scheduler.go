// Package cron provides a robfig/cron-based implementation of port.JobScheduler.
package cron

import (
	"time"

	"bot-trade/application/port/outbound"

	"github.com/robfig/cron/v3"
)

var _ outbound.JobScheduler = (*JobScheduler)(nil)

// JobScheduler wraps robfig/cron to implement port.JobScheduler.
type JobScheduler struct {
	cron *cron.Cron
}

// NewJobScheduler creates a new cron-based JobScheduler using UTC.
func NewJobScheduler() *JobScheduler {
	return &JobScheduler{
		cron: cron.New(cron.WithLocation(time.UTC)),
	}
}

func (s *JobScheduler) AddJob(schedule string, job func()) error {
	_, err := s.cron.AddFunc(schedule, job)
	return err
}

func (s *JobScheduler) Start() {
	s.cron.Start()
}

func (s *JobScheduler) Stop() {
	s.cron.Stop()
}
