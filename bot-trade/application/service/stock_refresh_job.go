package service

import (
	"context"
	"time"

	"bot-trade/application/port/inbound"

	"go.uber.org/zap"
)

func init() {
	RegisterFactory("stock_refresh", NewStockRefreshJobFromDeps)
}

// StockRefreshJob refreshes the stock metrics cache (RS Rating data).
type StockRefreshJob struct {
	schedule string
	timeout  time.Duration
	usecase  inbound.StockMetricsManager
	logger   *zap.Logger
}

// NewStockRefreshJobFromDeps creates a stock refresh job if enabled.
func NewStockRefreshJobFromDeps(deps JobDependencies) ([]inbound.Job, error) {
	cfg := deps.Config.StockRefresh
	if !cfg.AutoStart {
		return nil, nil
	}

	// Get schedule from the default interval
	ic, ok := cfg.Intervals["default"]
	if !ok || ic.Schedule == "" {
		return nil, nil
	}

	return []inbound.Job{&StockRefreshJob{
		schedule: ic.Schedule,
		timeout:  cfg.Timeout,
		usecase:  deps.StockMetricsManager,
		logger:   deps.Logger,
	}}, nil
}

func (j *StockRefreshJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:     "stock-refresh",
		Schedule: j.schedule,
		Enabled:  true,
		Timeout:  j.timeout,
	}
}

func (j *StockRefreshJob) Execute(ctx context.Context) error {
	result, err := j.usecase.Refresh(ctx)
	if err != nil {
		j.logger.Error("Failed to refresh stock metrics", zap.Error(err))
		return err
	}

	j.logger.Info("Stock metrics refresh completed",
		zap.Int("total_stocks", result.TotalStocksAnalyzed),
		zap.Time("calculated_at", result.CalculatedAt),
	)
	return nil
}
