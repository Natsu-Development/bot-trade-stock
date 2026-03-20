package refresh

import (
	"context"
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/jobs/registry"

	"go.uber.org/zap"
)

func init() {
	registry.RegisterFactory("stock_refresh", NewStockRefreshJobFromDeps)
}

// StockRefreshJob refreshes the stock metrics cache (RS Rating data).
type StockRefreshJob struct {
	schedule string
	timeout  time.Duration
	usecase  inbound.StockMetricsManager
}

// NewStockRefreshJobFromDeps creates a stock refresh job if enabled.
func NewStockRefreshJobFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	cfg := deps.Config.StockRefresh

	// Get schedule from the default interval
	ic, ok := cfg.Intervals["default"]
	if !ok || !ic.Enabled || ic.Schedule == "" {
		return nil, nil
	}

	return []inbound.Job{&StockRefreshJob{
		schedule: ic.Schedule,
		timeout:  cfg.Timeout,
		usecase:  deps.StockMetricsManager,
	}}, nil
}

func (j *StockRefreshJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:     "stock-refresh",
		Schedule: j.schedule,
		Timeout:  j.timeout,
	}
}

func (j *StockRefreshJob) Execute(ctx context.Context) error {
	result, err := j.usecase.Refresh(ctx)
	if err != nil {
		zap.L().Error("Failed to refresh stock metrics", zap.Error(err))
		return err
	}

	zap.L().Info("Stock metrics refresh completed",
		zap.Int("total_stocks", result.TotalStocksAnalyzed),
		zap.Time("calculated_at", result.CalculatedAt),
	)
	return nil
}
