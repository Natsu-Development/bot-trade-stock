package outbound

// JobScheduler abstracts cron-style job registration and lifecycle.
// Implemented by infrastructure/cron, consumed by application services.
type JobScheduler interface {
	AddJob(schedule string, job func()) error
	Start()
	Stop()
}

// IntervalConfig holds configuration for a single cron interval.
type IntervalConfig struct {
	Enabled  bool
	Schedule string
}
