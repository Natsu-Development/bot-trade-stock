// Package server provides HTTP server lifecycle management.
package server

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Config holds HTTP server configuration.
type Config struct {
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// Server wraps http.Server with lifecycle management.
type Server struct {
	httpServer      *http.Server
	shutdownTimeout time.Duration
}

// New creates a new Server with the given configuration and handler.
func New(cfg Config, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         fmt.Sprintf(":%d", cfg.Port),
			Handler:      handler,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
		},
		shutdownTimeout: cfg.ShutdownTimeout,
	}
}

// Addr returns the server address.
func (s *Server) Addr() string {
	return s.httpServer.Addr
}

// Start starts the HTTP server. It blocks until the server stops.
// Returns http.ErrServerClosed on graceful shutdown.
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
}
