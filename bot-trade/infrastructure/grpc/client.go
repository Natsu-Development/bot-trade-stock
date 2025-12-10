package grpc

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// ClientConfig holds gRPC client configuration.
// This struct allows the infrastructure layer to remain independent
// of application configuration, following the Dependency Inversion Principle.
type ClientConfig struct {
	ServerAddress     string
	ConnectionTimeout time.Duration
	RequestTimeout    time.Duration
}

// NewClientConfig creates a new ClientConfig with the specified values.
func NewClientConfig(serverAddress string, connectionTimeout, requestTimeout time.Duration) *ClientConfig {
	return &ClientConfig{
		ServerAddress:     serverAddress,
		ConnectionTimeout: connectionTimeout,
		RequestTimeout:    requestTimeout,
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
