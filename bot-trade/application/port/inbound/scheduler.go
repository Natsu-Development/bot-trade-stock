package inbound

// CronScheduler defines the interface for cron scheduling operations.
// Implemented by DivergenceScheduler, consumed by wire/main for lifecycle management.
type CronScheduler interface {
	Start() error
	Stop()
	IsRunning() bool
}
