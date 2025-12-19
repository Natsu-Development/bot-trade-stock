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
		app.Logger().Info("HTTP server starting", zap.String("addr", srv.Addr()))
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP server failed: ", err)
		}
	}()

	waitForShutdown()

	app.Logger().Info("Shutting down...")
	if err := srv.Shutdown(); err != nil {
		app.Logger().Error("Server shutdown error", zap.Error(err))
	}
}

func waitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
}
