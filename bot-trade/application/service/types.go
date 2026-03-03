package service

// IntervalConfig holds configuration for a single cron interval.
// Defined in the application layer so schedulers don't depend on the infrastructure config package.
type IntervalConfig struct {
	Enabled  bool
	Schedule string
}
