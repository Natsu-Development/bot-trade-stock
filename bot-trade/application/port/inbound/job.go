// Package inbound defines primary (driving) port interfaces.
// These represent what the application offers to the outside world.
// Implemented by use cases and jobs, consumed by presentation handlers and schedulers.
package inbound

import (
	"context"
	"time"
)

// JobMetadata contains job configuration.
type JobMetadata struct {
	Name        string
	Schedule    string
	Timeout     time.Duration
	Concurrency int
}

// Job is a unit of schedulable work.
type Job interface {
	Metadata() JobMetadata
	Execute(ctx context.Context) error
}
