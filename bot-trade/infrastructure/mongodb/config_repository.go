package mongodb

import (
	"context"

	"bot-trade/domain/aggregate/config"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const collectionName = "bot_config"

// ConfigRepository implements the ConfigRepository interface using MongoDB.
type ConfigRepository struct {
	collection *mongo.Collection
}

// NewConfigRepository creates a new MongoDB-based ConfigRepository.
func NewConfigRepository(client *mongo.Client, databaseName string) *ConfigRepository {
	collection := client.Database(databaseName).Collection(collectionName)
	return &ConfigRepository{collection: collection}
}

// Create inserts a new configuration document.
func (r *ConfigRepository) Create(ctx context.Context, cfg *config.TradingConfig) error {
	_, err := r.collection.InsertOne(ctx, cfg)
	return err
}

// GetByID retrieves configuration by its unique ID.
func (r *ConfigRepository) GetByID(ctx context.Context, id string) (*config.TradingConfig, error) {
	var cfg config.TradingConfig
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&cfg)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, config.ErrConfigNotFound
		}
		return nil, err
	}
	return &cfg, nil
}

// GetAll retrieves all configuration documents.
func (r *ConfigRepository) GetAll(ctx context.Context) ([]*config.TradingConfig, error) {
	cursor, err := r.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var configs []*config.TradingConfig
	for cursor.Next(ctx) {
		var cfg config.TradingConfig
		if err := cursor.Decode(&cfg); err != nil {
			return nil, err
		}
		configs = append(configs, &cfg)
	}

	if err := cursor.Err(); err != nil {
		return nil, err
	}

	return configs, nil
}

// Update replaces an existing configuration document.
func (r *ConfigRepository) Update(ctx context.Context, cfg *config.TradingConfig) error {
	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": cfg.ID}, cfg)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return config.ErrConfigNotFound
	}
	return nil
}

// Delete removes a configuration document by ID.
func (r *ConfigRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return config.ErrConfigNotFound
	}
	return nil
}
