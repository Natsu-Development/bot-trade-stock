// Package outbound defines secondary (driven) port interfaces.
// These represent what the application needs from the outside world.
package outbound

// CronAdapter abstracts the cron implementation.
// This interface allows the application layer to schedule jobs without
// depending on a specific cron library.
type CronAdapter interface {
	AddFunc(spec string, cmd func()) error
	Start()
	Stop()
}
