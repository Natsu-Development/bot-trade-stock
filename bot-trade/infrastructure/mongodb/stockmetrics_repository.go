package mongodb

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/stockmetrics"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const stockMetricsCollectionName = "stock_metrics"
const stockMetricsDocID = "latest"

// stockMetricsDocument represents the MongoDB document structure for stock metrics.
type stockMetricsDocument struct {
	ID           string                     `bson:"_id"`
	Metrics      []*stockmetrics.StockMetrics `bson:"metrics"`
	CalculatedAt time.Time                  `bson:"calculated_at"`
}

// StockMetricsRepository implements the StockMetricsRepository interface using MongoDB.
type StockMetricsRepository struct {
	collection *mongo.Collection
}

// NewStockMetricsRepository creates a new MongoDB-based StockMetricsRepository.
func NewStockMetricsRepository(client *mongo.Client, databaseName string) *StockMetricsRepository {
	collection := client.Database(databaseName).Collection(stockMetricsCollectionName)
	return &StockMetricsRepository{collection: collection}
}

// Save persists the stock metrics to MongoDB.
// Uses upsert to replace the existing document with the new metrics.
func (r *StockMetricsRepository) Save(ctx context.Context, metrics []*stockmetrics.StockMetrics, calculatedAt time.Time) error {
	doc := stockMetricsDocument{
		ID:           stockMetricsDocID,
		Metrics:      metrics,
		CalculatedAt: calculatedAt,
	}

	opts := options.Replace().SetUpsert(true)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": stockMetricsDocID}, doc, opts)
	return err
}

// LoadLatest retrieves the most recent stock metrics from MongoDB.
// Returns empty slice and zero time if no metrics exist.
func (r *StockMetricsRepository) LoadLatest(ctx context.Context) ([]*stockmetrics.StockMetrics, time.Time, error) {
	var doc stockMetricsDocument
	err := r.collection.FindOne(ctx, bson.M{"_id": stockMetricsDocID}).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, time.Time{}, nil
		}
		return nil, time.Time{}, err
	}
	return doc.Metrics, doc.CalculatedAt, nil
}
