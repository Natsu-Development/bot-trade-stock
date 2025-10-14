package grpc

import (
	"context"
	"fmt"
	"time"

	"bot-trade/internal/config"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// ClientConfig holds gRPC client configuration
type ClientConfig struct {
	ServerAddress     string
	ConnectionTimeout time.Duration
	RequestTimeout    time.Duration
}

// NewClientConfigFromEnv creates ClientConfig from application config
func NewClientConfigFromEnv(cfg *config.Config) *ClientConfig {
	return &ClientConfig{
		ServerAddress:     cfg.GRPCServerAddr,
		ConnectionTimeout: time.Duration(cfg.GRPCConnectionTimeout) * time.Second,
		RequestTimeout:    time.Duration(cfg.GRPCRequestTimeout) * time.Second,
	}
}

// NewConnection creates a new gRPC connection with the specified configuration
func NewConnection(config *ClientConfig) (*grpc.ClientConn, error) {
	// Create connection context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), config.ConnectionTimeout)
	defer cancel()

	// Establish gRPC connection
	conn, err := grpc.DialContext(
		ctx,
		config.ServerAddress,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(), // Wait for connection to be established
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gRPC server at %s: %w", config.ServerAddress, err)
	}

	return conn, nil
}

// NewConnectionWithConfig creates a new gRPC connection using application config
func NewConnectionWithConfig(cfg *config.Config) (*grpc.ClientConn, error) {
	clientConfig := NewClientConfigFromEnv(cfg)
	return NewConnection(clientConfig)
}
