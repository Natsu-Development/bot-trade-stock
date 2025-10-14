package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/config"
	"bot-trade/internal/infrastructure/telegram"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// BaseCronScheduler provides shared utilities for cron schedulers
type BaseCronScheduler struct {
	cron              *cron.Cron
	logger            *zap.Logger
	predefinedSymbols []string
	config            *config.Config
	telegramNotifier  *telegram.Notifier
	isRunning         bool
	mu                sync.RWMutex
	schedulerType     string
}

// NewBaseCronScheduler creates a new base cron scheduler
func NewBaseCronScheduler(
	logger *zap.Logger,
	cfg *config.Config,
	schedulerType string,
) *BaseCronScheduler {
	return &BaseCronScheduler{
		cron:              cron.New(cron.WithLocation(time.UTC)),
		logger:            logger,
		predefinedSymbols: cfg.DefaultSymbols,
		config:            cfg,
		telegramNotifier:  telegram.NewNotifier(cfg.TelegramBotToken, cfg.TelegramChatID, cfg.TelegramEnabled),
		isRunning:         false,
		schedulerType:     schedulerType,
	}
}

// Stop stops the cron scheduler
func (bcs *BaseCronScheduler) Stop() {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		bcs.cron.Stop()
		bcs.isRunning = false
		bcs.logger.Info("🛑 Cron scheduler stopped",
			zap.String("type", bcs.schedulerType),
		)
	}
}

// IsRunning returns whether the scheduler is running
func (bcs *BaseCronScheduler) IsRunning() bool {
	bcs.mu.RLock()
	defer bcs.mu.RUnlock()
	return bcs.isRunning
}

// UpdateSymbols updates the predefined symbols list
func (bcs *BaseCronScheduler) UpdateSymbols(symbols []string) {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()
	bcs.predefinedSymbols = symbols
	bcs.logger.Info("📝 Updated symbols", zap.Int("count", len(symbols)))
}

// GetSymbols returns the current list of symbols
func (bcs *BaseCronScheduler) GetSymbols() []string {
	bcs.mu.RLock()
	defer bcs.mu.RUnlock()
	return bcs.predefinedSymbols
}

// CreateAnalysisRequest creates a standardized analysis request
func (bcs *BaseCronScheduler) CreateAnalysisRequest(symbol, startDate, endDate, interval string) *dto.AnalysisRequest {
	return &dto.AnalysisRequest{
		Symbol:    symbol,
		StartDate: startDate,
		EndDate:   endDate,
		Interval:  interval,
	}
}

// CalculateDateRange calculates the date range based on offset
func (bcs *BaseCronScheduler) CalculateDateRange(startDateOffset int) (string, string) {
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -startDateOffset).Format("2006-01-02")
	return startDate, endDate
}

// CreateAnalysisContext creates a context with timeout for analysis operations
func (bcs *BaseCronScheduler) CreateAnalysisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Minute)
}

// ProcessSymbolsConcurrently processes symbols concurrently and returns results
func (bcs *BaseCronScheduler) ProcessSymbolsConcurrently(
	ctx context.Context,
	symbols []string,
	processFunc func(context.Context, string) (*dto.DivergenceAnalysisResponse, error),
) (map[string]*dto.DivergenceAnalysisResponse, map[string]error) {
	results := make(map[string]*dto.DivergenceAnalysisResponse)
	errors := make(map[string]error)

	var wg sync.WaitGroup
	resultChan := make(chan struct {
		symbol   string
		response *dto.DivergenceAnalysisResponse
		err      error
	}, len(symbols))

	// Process each symbol concurrently
	for _, symbol := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			response, err := processFunc(ctx, sym)
			resultChan <- struct {
				symbol   string
				response *dto.DivergenceAnalysisResponse
				err      error
			}{sym, response, err}
		}(symbol)
	}

	// Close channel when all goroutines are done
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	for result := range resultChan {
		if result.err != nil {
			errors[result.symbol] = result.err
			bcs.logger.Error("❌ Analysis failed",
				zap.String("symbol", result.symbol),
				zap.Error(result.err),
			)
		} else {
			results[result.symbol] = result.response
		}
	}

	return results, errors
}

// NotifyTelegram sends a Telegram notification (handles all checks internally)
func (bcs *BaseCronScheduler) NotifyTelegram(divergenceType, interval, symbol, description string) {
	icon := "🔴"
	if divergenceType == "bullish" {
		icon = "🟢"
	}

	message := formatTelegramMessage(icon, divergenceType, interval, symbol, description)

	if err := bcs.telegramNotifier.SendMessage(message); err != nil {
		bcs.logger.Error("Failed to send Telegram notification",
			zap.String("type", divergenceType),
			zap.String("symbol", symbol),
			zap.Error(err),
		)
	}
}

// formatTelegramMessage formats a divergence alert message
func formatTelegramMessage(icon, divergenceType, interval, symbol, description string) string {
	return fmt.Sprintf(
		"%s <b>%s Divergence Alert</b>\n\n"+
			"📊 Symbol: <b>%s</b>\n"+
			"⏱ Interval: <b>%s</b>\n"+
			"📉 %s\n",
		icon, divergenceType, symbol, interval, description,
	)
}
