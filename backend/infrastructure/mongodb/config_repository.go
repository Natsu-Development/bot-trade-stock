package mongodb

import (
	"context"
	"errors"
	"time"

	"bot-trade/application/port/outbound"
	"bot-trade/domain/config"
	configagg "bot-trade/domain/config/aggregate"
	configvo "bot-trade/domain/config/valueobject"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var _ outbound.ConfigRepository = (*ConfigRepository)(nil)

// ConfigRepository implements the ConfigRepository interface using MongoDB.
type ConfigRepository struct {
	collection *mongo.Collection
}

// NewConfigRepository creates a new MongoDB-based ConfigRepository.
// collectionName specifies the MongoDB collection to use (e.g. "bot_config").
func NewConfigRepository(client *mongo.Client, databaseName, collectionName string) *ConfigRepository {
	collection := client.Database(databaseName).Collection(collectionName)
	return &ConfigRepository{collection: collection}
}

// Create inserts a new configuration document.
func (r *ConfigRepository) Create(ctx context.Context, cfg *configagg.TradingConfig) error {
	_, err := r.collection.InsertOne(ctx, cfg)
	return err
}

// GetByID retrieves configuration by its unique ID.
func (r *ConfigRepository) GetByID(ctx context.Context, id string) (*configagg.TradingConfig, error) {
	var cfg configagg.TradingConfig
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&cfg)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, config.ErrConfigNotFound
		}
		return nil, err
	}
	return &cfg, nil
}

// GetAll retrieves all configuration documents.
func (r *ConfigRepository) GetAll(ctx context.Context) ([]*configagg.TradingConfig, error) {
	cursor, err := r.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var configs []*configagg.TradingConfig
	for cursor.Next(ctx) {
		var cfg configagg.TradingConfig
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
func (r *ConfigRepository) Update(ctx context.Context, cfg *configagg.TradingConfig) error {
	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": cfg.ID}, cfg)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return config.ErrConfigNotFound
	}
	return nil
}

// SetConditionEnabled toggles a single alert condition's enabled flag using a
// positional arrayFilter scoped to the matching (symbol, type, reference). Mongo
// applies arrayFilter updates atomically at the document level, so concurrent
// disables of different conditions on the same doc both survive (no clobber).
func (r *ConfigRepository) SetConditionEnabled(ctx context.Context, configID, symbol string, cond configvo.AlertCondition, enabled bool) error {
	// The (symbol,type,reference) identity assumes ≤1 condition per pair, enforced
	// by StockAlertConfig.Validate's duplicate guard. reference defaults to "" for
	// non-cross types; match missing-or-empty so old docs without the field still match.
	condFilter := bson.M{
		"c.type": string(cond.Type),
		"$or": bson.A{
			bson.M{"c.reference": cond.Reference},
			bson.M{"c.reference": bson.M{"$exists": false}},
		},
	}
	if cond.Reference != "" {
		condFilter = bson.M{
			"c.type":      string(cond.Type),
			"c.reference": cond.Reference,
		}
	}

	arrayFilters := options.ArrayFilters{
		Filters: bson.A{
			bson.M{"a.symbol": symbol},
			condFilter,
		},
	}

	update := bson.M{
		"$set": bson.M{
			"alerts.$[a].conditions.$[c].enabled": enabled,
			"updated_at":                          time.Now(),
		},
	}

	opts := options.Update().SetArrayFilters(arrayFilters)
	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": configID}, update, opts)
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
