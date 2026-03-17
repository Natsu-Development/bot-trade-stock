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
	logger  *zap.Logger
}

// NewJobScheduler creates a new JobScheduler with the given cron adapter.
func NewJobScheduler(adapter outbound.CronAdapter, logger *zap.Logger) *JobScheduler {
	return &JobScheduler{
		adapter: adapter,
		logger:  logger,
	}
}

// Register registers a job with the scheduler.
func (s *JobScheduler) Register(job inbound.Job) error {
	meta := job.Metadata()

	if err := s.adapter.AddFunc(meta.Schedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), meta.Timeout)
		defer cancel()

		s.logger.Info("Job started", zap.String("name", meta.Name))
		if err := job.Execute(ctx); err != nil {
			s.logger.Error("Job failed",
				zap.String("name", meta.Name),
				zap.Error(err),
			)
		}
	}); err != nil {
		return fmt.Errorf("schedule job %s: %w", meta.Name, err)
	}

	s.logger.Info("Job registered",
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
	s.logger.Info("Scheduler started")
}

// Stop stops the scheduler.
func (s *JobScheduler) Stop() {
	s.adapter.Stop()
	s.logger.Info("Scheduler stopped")
}
