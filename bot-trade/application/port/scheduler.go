// Package port defines application-layer interface contracts.
package port

// CronScheduler defines the interface for cron scheduling operations.
// This interface enables handlers and main.go to depend on an abstraction
// rather than a concrete scheduler implementation.
type CronScheduler interface {
	// Start starts the cron scheduler.
	// Returns an error if the scheduler cannot be started.
	Start() error

	// Stop stops the cron scheduler gracefully.
	Stop()

	// IsRunning returns whether the scheduler is currently running.
	IsRunning() bool
}
