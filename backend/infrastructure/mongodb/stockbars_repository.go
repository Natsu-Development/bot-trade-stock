package mongodb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"backend/application/port/outbound"
	marketvo "backend/domain/shared/valueobject/market"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var _ outbound.StockBarsRepository = (*StockBarsRepository)(nil)

const (
	stockBarsDocID = "latest"

	// maxBarsDocBytes caps the compressed bars blob below Mongo's 16 MiB per-document
	// hard limit. The full VN equity universe compresses well under this (~3-8 MiB);
	// SaveBars refuses to write a blob over the ceiling rather than letting Mongo
	// reject an oversized document mid-refresh.
	maxBarsDocBytes = 15 << 20 // 15 MiB
)

// stockBarsDocument stores the compressed raw-bar blob for one refresh. Data is the
// codec-encoded map[string][]MarketData (opaque binary); Codec versions the format
// so an unknown encoding is rejected on read instead of mis-decoded. CalculatedAt
// mirrors the metrics doc's stamp for the boot consistency check.
type stockBarsDocument struct {
	ID           string    `bson:"_id"`
	Codec        string    `bson:"codec"`
	Data         []byte    `bson:"data"`
	CalculatedAt time.Time `bson:"calculated_at"`
	SymbolCount  int       `bson:"symbol_count"`
}

// StockBarsRepository implements the StockBarsRepository interface using MongoDB.
type StockBarsRepository struct {
	collection *mongo.Collection
}

// NewStockBarsRepository creates a new MongoDB-based StockBarsRepository.
// collectionName holds the compressed raw-bar blob (e.g. "stock_bars").
func NewStockBarsRepository(client *mongo.Client, databaseName, collectionName string) *StockBarsRepository {
	return &StockBarsRepository{
		collection: client.Database(databaseName).Collection(collectionName),
	}
}

// SaveBars persists the compressed raw-bar blob, stamped with the refresh's
// calculatedAt, via upsert. It refuses (without writing) a blob over
// maxBarsDocBytes so an oversized series can never abort the refresh at the Mongo
// layer.
func (r *StockBarsRepository) SaveBars(ctx context.Context, bars map[string][]marketvo.MarketData, calculatedAt time.Time) error {
	blob, err := encodeBars(bars)
	if err != nil {
		return fmt.Errorf("encode bars: %w", err)
	}
	if len(blob) > maxBarsDocBytes {
		return fmt.Errorf("compressed bars %d bytes exceed the %d-byte ceiling; not persisted", len(blob), maxBarsDocBytes)
	}

	doc := stockBarsDocument{
		ID:           stockBarsDocID,
		Codec:        barsCodecVersion,
		Data:         blob,
		CalculatedAt: calculatedAt,
		SymbolCount:  len(bars),
	}

	opts := options.Replace().SetUpsert(true)
	_, err = r.collection.ReplaceOne(ctx, bson.M{"_id": stockBarsDocID}, doc, opts)
	return err
}

// LoadBars retrieves the persisted raw bars and their stamp. Returns (nil, zero,
// nil) when none exist. An unknown codec or a decode failure returns an error so
// the caller adopts no bars rather than booting on a corrupt series.
func (r *StockBarsRepository) LoadBars(ctx context.Context) (map[string][]marketvo.MarketData, time.Time, error) {
	var doc stockBarsDocument
	err := r.collection.FindOne(ctx, bson.M{"_id": stockBarsDocID}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, time.Time{}, nil
		}
		return nil, time.Time{}, err
	}

	if doc.Codec != barsCodecVersion {
		return nil, time.Time{}, fmt.Errorf("unknown bars codec %q (want %q)", doc.Codec, barsCodecVersion)
	}

	bars, err := decodeBars(doc.Data)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("decode bars: %w", err)
	}
	return bars, doc.CalculatedAt, nil
}
