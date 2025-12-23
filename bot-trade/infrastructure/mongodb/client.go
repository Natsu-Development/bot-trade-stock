// Package mongodb provides MongoDB client connection management.
package mongodb

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ConnectMongoDB establishes connection to MongoDB with timeout.
// Returns client or error if connection fails within timeout.
func ConnectMongoDB(ctx context.Context, uri string, timeout time.Duration) (*mongo.Client, error) {
	if uri == "" {
		return nil, fmt.Errorf("MONGODB_URI is not set or empty")
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Verify connection with Ping
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return client, nil
}

