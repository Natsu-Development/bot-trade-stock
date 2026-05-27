package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bot-trade/config"
	"bot-trade/pkg/server"
	"bot-trade/wire"

	"go.uber.org/zap"
)

func main() {
	cfg, err := config.LoadInfraFromEnv()
	if err != nil {
		log.Fatal("Failed to load configuration: ", err)
	}

	app, err := wire.New(cfg)
	if err != nil {
		log.Fatal("Failed to initialize application: ", err)
	}
	defer app.Close()

	app.StartSchedulers()

	srv := server.New(server.Config{
		Port:            cfg.HTTPPort,
		ReadTimeout:     time.Duration(cfg.HTTPReadTimeout) * time.Second,
		WriteTimeout:    time.Duration(cfg.HTTPWriteTimeout) * time.Second,
		IdleTimeout:     time.Duration(cfg.HTTPIdleTimeout) * time.Second,
		ShutdownTimeout: time.Duration(cfg.HTTPShutdownTimeout) * time.Second,
	}, app.Router())

	go func() {
		zap.L().Info("HTTP server starting", zap.String("addr", srv.Addr()))
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP server failed: ", err)
		}
	}()

	waitForShutdown(app)

	zap.L().Info("Shutting down...")
	if err := srv.Shutdown(); err != nil {
		zap.L().Error("Server shutdown error", zap.Error(err))
	}
}

// waitForShutdown blocks until SIGINT or SIGTERM is received.
// SIGHUP is scoped exclusively to SSI credential reload and does not trigger shutdown.
func waitForShutdown(app *wire.App) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
	// Emit pid + the signal set so on-call can verify SIGHUP delivery path:
	// `docker logs trading-bot | grep 'signal handler registered'` must show pid=1
	// and SIGHUP in the list — otherwise the Dockerfile entrypoint is wrapping
	// the binary without exec and SIGHUPs from the cookie-refresh service will
	// be silently swallowed at the wrapper instead of reaching this handler.
	zap.L().Info("signal handler registered",
		zap.Strings("signals", []string{"SIGINT", "SIGTERM", "SIGHUP"}),
		zap.Int("pid", os.Getpid()),
	)

	for sig := range sigChan {
		if sig == syscall.SIGHUP {
			start := time.Now()
			err := app.ReloadCredentials()
			durationMs := time.Since(start).Milliseconds()
			if err != nil {
				zap.L().Warn("ssi credentials reloaded",
					zap.String("event", "ssi credentials reloaded"),
					zap.Int64("duration_ms", durationMs),
					zap.String("result", "failure"),
					zap.String("error", err.Error()),
				)
			} else {
				zap.L().Info("ssi credentials reloaded",
					zap.String("event", "ssi credentials reloaded"),
					zap.Int64("duration_ms", durationMs),
					zap.String("result", "success"),
					zap.String("minted_at", app.CurrentCredentialMintedAt().Format(time.RFC3339)),
				)
			}
			continue
		}
		// SIGINT or SIGTERM — exit the loop and proceed with graceful shutdown.
		zap.L().Info("shutdown signal received", zap.String("signal", sig.String()))
		return
	}
}
