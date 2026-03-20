package service

import (
	"context"
	"fmt"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"

	"go.uber.org/zap"
)

// JobScheduler is a generic scheduler that runs jobs implementing the Job interface.
// It uses a CronAdapter to abstract the cron implementation details.
type JobScheduler struct {
	adapter outbound.CronAdapter
}

// NewJobScheduler creates a new JobScheduler with the given cron adapter.
func NewJobScheduler(adapter outbound.CronAdapter) *JobScheduler {
	return &JobScheduler{
		adapter: adapter,
	}
}

// Register registers a job with the scheduler.
func (s *JobScheduler) Register(job inbound.Job) error {
	meta := job.Metadata()

	if err := s.adapter.AddFunc(meta.Schedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), meta.Timeout)
		defer cancel()

		zap.L().Info("Job started", zap.String("name", meta.Name))
		if err := job.Execute(ctx); err != nil {
			zap.L().Error("Job failed",
				zap.String("name", meta.Name),
				zap.Error(err),
			)
		}
	}); err != nil {
		return fmt.Errorf("schedule job %s: %w", meta.Name, err)
	}

	zap.L().Info("Job registered",
		zap.String("name", meta.Name),
		zap.String("schedule", meta.Schedule),
	)
	return nil
}

// RegisterAll registers multiple jobs and returns the first error.
func (s *JobScheduler) RegisterAll(jobs []inbound.Job) error {
	for _, job := range jobs {
		if err := s.Register(job); err != nil {
			return err
		}
	}
	return nil
}

// Start starts the scheduler.
func (s *JobScheduler) Start() {
	s.adapter.Start()
	zap.L().Info("Scheduler started")
}

// Stop stops the scheduler.
func (s *JobScheduler) Stop() {
	s.adapter.Stop()
	zap.L().Info("Scheduler stopped")
}
