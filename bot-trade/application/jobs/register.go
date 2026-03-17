// Package jobs provides job registration via blank imports.
// Import this package to trigger init() functions in all job subpackages.
package jobs

import (
	// Blank imports trigger init() in each job package
	_ "bot-trade/application/jobs/analyze"
	_ "bot-trade/application/jobs/refresh"
)
