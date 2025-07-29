//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package adapters

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"log"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	core "github.com/datadog/serverless-sample-product-core"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/stdlib"

	_ "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dsql/auth"

	// Keep this as the underlying driver
	"github.com/jmoiron/sqlx"
	sqltrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/database/sql"
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	Region   string
}

type DSQLTokenManager struct {
	mu              sync.RWMutex
	token           string
	expiresAt       time.Time
	clusterEndpoint string
	user            string
	region          string
	refreshBuffer   time.Duration // Refresh token when 80% of expiry time has passed
}

type DSQLConnectionFactory struct {
	tokenManager *DSQLTokenManager
	config       Config
}

type DSqlProductRepository struct {
	connectionFactory *DSQLConnectionFactory
}

func NewDSQLTokenManager(clusterEndpoint, user, region string) *DSQLTokenManager {
	return &DSQLTokenManager{
		clusterEndpoint: clusterEndpoint,
		user:            user,
		region:          region,
		refreshBuffer:   3 * time.Minute, // Refresh token 3 minutes before expiry (80% of 15 min)
	}
}

func (tm *DSQLTokenManager) GetToken(ctx context.Context) (string, error) {
	tm.mu.RLock()
	if tm.token != "" && time.Now().Add(tm.refreshBuffer).Before(tm.expiresAt) {
		token := tm.token
		tm.mu.RUnlock()
		return token, nil
	}
	tm.mu.RUnlock()

	return tm.refreshToken(ctx)
}

func (tm *DSQLTokenManager) refreshToken(ctx context.Context) (string, error) {
	span, _ := tracer.StartSpanFromContext(ctx, "db.refreshToken")
	defer span.Finish()
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// Double-check pattern - another goroutine might have refreshed the token
	if tm.token != "" && time.Now().Add(tm.refreshBuffer).Before(tm.expiresAt) {
		return tm.token, nil
	}

	log.Println("Refreshing DSQL auth token...")

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	tokenOptions := func(options *auth.TokenOptions) {
		options.ExpiresIn = 15 * time.Minute
	}

	var token string
	if tm.user == "admin" {
		token, err = auth.GenerateDBConnectAdminAuthToken(ctx, tm.clusterEndpoint, tm.region, cfg.Credentials, tokenOptions)
		if err != nil {
			return "", fmt.Errorf("failed to generate admin auth token: %w", err)
		}
	} else {
		token, err = auth.GenerateDbConnectAuthToken(ctx, tm.clusterEndpoint, tm.region, cfg.Credentials, tokenOptions)
		if err != nil {
			return "", fmt.Errorf("failed to generate auth token: %w", err)
		}
	}

	tm.token = token
	tm.expiresAt = time.Now().Add(15 * time.Minute)

	log.Printf("DSQL auth token refreshed, expires at: %v", tm.expiresAt)
	return token, nil
}

func NewDSQLConnectionFactory(clusterEndpoint, user, region string) *DSQLConnectionFactory {
	tokenManager := NewDSQLTokenManager(clusterEndpoint, user, region)

	config := Config{
		Host:     clusterEndpoint,
		User:     user,
		Region:   region,
		Port:     "5431",
		Database: "postgres",
	}

	return &DSQLConnectionFactory{
		tokenManager: tokenManager,
		config:       config,
	}
}

func (cf *DSQLConnectionFactory) CreateConnection(ctx context.Context) (*sqlx.DB, error) {
	span, _ := tracer.StartSpanFromContext(ctx, "db.init")
	defer span.Finish()

	token, err := cf.tokenManager.GetToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get auth token: %w", err)
	}

	baseURL := fmt.Sprintf("postgres://%s:5432/postgres", cf.config.Host)
	connURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection URL: %w", err)
	}

	q := connURL.Query()
	q.Set("user", cf.config.User)
	q.Set("password", token)
	q.Set("sslmode", "verify-full")
	connURL.RawQuery = q.Encode()

	db, err := sqltrace.Open("pgx", connURL.String())
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	dbx := sqlx.NewDb(db, "pgx")

	// Set appropriate connection pool settings for token refresh pattern
	dbx.SetMaxOpenConns(10)
	dbx.SetMaxIdleConns(2)                   // Reduced idle connections to encourage fresh connections
	dbx.SetConnMaxLifetime(12 * time.Minute) // Shorter than token expiry to force refresh
	dbx.SetConnMaxIdleTime(5 * time.Minute)  // Close idle connections sooner

	// Test the connection
	if err := dbx.PingContext(ctx); err != nil {
		dbx.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return dbx, nil
}

func NewDSqlProductRepository(clusterEndpoint string) (*DSqlProductRepository, error) {
	log.Println("Cluster endpoint: ", clusterEndpoint)
	sqltrace.Register("pgx", &stdlib.Driver{}, sqltrace.WithServiceName("product-api-db"))

	connectionFactory := NewDSQLConnectionFactory(clusterEndpoint, "admin", os.Getenv("AWS_REGION"))

	repository := &DSqlProductRepository{
		connectionFactory: connectionFactory,
	}

	// Apply migrations using per-operation connection
	ctx := context.Background()
	err := repository.ApplyMigrations(ctx)
	if err != nil {
		log.Println("Failed to apply migrations: ", err)
		return nil, err
	}

	return repository, nil
}

func (repo *DSqlProductRepository) withConnection(ctx context.Context, fn func(*sqlx.DB) error) error {
	conn, err := repo.connectionFactory.CreateConnection(ctx)
	if err != nil {
		return fmt.Errorf("failed to create connection: %w", err)
	}
	defer conn.Close()

	return fn(conn)
}

func (repo *DSqlProductRepository) WithTransaction(ctx context.Context, fn func(*sqlx.Tx) error) error {
	span, _ := tracer.StartSpanFromContext(ctx, "db.withTransaction")
	defer span.Finish()

	return repo.withConnection(ctx, func(conn *sqlx.DB) error {
		tx, err := conn.BeginTxx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin transaction: %w", err)
		}
		defer tx.Rollback() // Safe to call even after commit

		if err := fn(tx); err != nil {
			return err
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit transaction: %w", err)
		}

		return nil
	})
}

func (repo *DSqlProductRepository) executeWithRetry(ctx context.Context, operation func(*sqlx.DB) error) error {
	const maxRetries = 2

	for attempt := 0; attempt <= maxRetries; attempt++ {

		err := repo.withConnection(ctx, operation)
		if err == nil {
			return nil // Success
		}

		// Check if it's an authentication error that might be resolved with a new connection
		if isAuthError(err) && attempt < maxRetries {
			log.Printf("Authentication error on attempt %d, will retry: %v", attempt+1, err)
			continue
		}

		if attempt == maxRetries {
			return fmt.Errorf("operation failed after %d attempts: %w", maxRetries+1, err)
		}
	}

	return fmt.Errorf("operation failed after %d attempts", maxRetries+1)
}

func isAuthError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "authentication") ||
		strings.Contains(errStr, "password") ||
		strings.Contains(errStr, "token") ||
		strings.Contains(errStr, "invalid credentials") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "permission denied")
}

func (repo *DSqlProductRepository) Store(ctx context.Context, p core.Product) error {
	// Use transaction to ensure atomic product and price bracket insertion
	return repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO products (id, name, previous_name, price, previous_price, stock_level, updated)
			VALUES ($1, $2, NULL, $3, NULL, $4, FALSE)
			ON CONFLICT (id) DO NOTHING
		`, p.Id, p.Name, p.Price, p.StockLevel)
		if err != nil {
			return err
		}

		// Insert price brackets atomically with product
		for _, pb := range p.PriceBreakdown {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO product_prices (product_id, quantity, price)
				VALUES ($1, $2, $3)
			`, p.Id, pb.Quantity, pb.Price)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (repo *DSqlProductRepository) Update(ctx context.Context, p core.Product) error {
	// Use transaction to ensure atomic product and price bracket updates
	return repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `
			UPDATE products
			SET name = $2, price = $3, stock_level = $4, updated = TRUE
			WHERE id = $1
		`, p.Id, p.Name, p.Price, p.StockLevel)
		if err != nil {
			return err
		}

		// Remove old price brackets and insert new ones atomically
		_, err = tx.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, p.Id)
		if err != nil {
			return err
		}
		for _, pb := range p.PriceBreakdown {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO product_prices (product_id, quantity, price)
				VALUES ($1, $2, $3)
			`, p.Id, pb.Quantity, pb.Price)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (repo *DSqlProductRepository) Get(ctx context.Context, productId string) (*core.Product, error) {
	var result *core.Product
	var resultErr error

	err := repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		row := conn.QueryRowContext(ctx, `
			SELECT id, name, price, stock_level
			FROM products
			WHERE id = $1
		`, productId)

		var p core.Product
		err := row.Scan(&p.Id, &p.Name, &p.Price, &p.StockLevel)
		if err != nil {
			resultErr = err
			return err
		}

		rows, err := conn.QueryContext(ctx, `
			SELECT quantity, price
			FROM product_prices
			WHERE product_id = $1
		`, productId)
		if err != nil {
			resultErr = err
			return err
		}
		defer rows.Close()

		var priceBrackets []core.ProductPrice
		for rows.Next() {
			var pb core.ProductPrice
			if err := rows.Scan(&pb.Quantity, &pb.Price); err != nil {
				resultErr = err
				return err
			}
			priceBrackets = append(priceBrackets, pb)
		}
		p.PriceBreakdown = priceBrackets
		result = &p
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, resultErr
}

func (repo *DSqlProductRepository) Delete(ctx context.Context, productId string) {
	// Use transaction to ensure atomic deletion of product and price brackets
	_ = repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, productId)
		if err != nil {
			log.Printf("Error deleting product: %v", err)
			return err // Let transaction handle rollback
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, productId)
		if err != nil {
			log.Printf("Error deleting product prices: %v", err)
			return err // Let transaction handle rollback
		}
		return nil
	})
}

func (repo *DSqlProductRepository) List(ctx context.Context) ([]core.Product, error) {
	var result []core.Product
	var resultErr error

	err := repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		rows, err := conn.QueryContext(ctx, `
			SELECT 
				p.id AS product_id, 
				p.name AS product_name, 
				p.price AS product_price, 
				p.stock_level AS product_stock_level, 
				pp.quantity AS price_quantity, 
				pp.price AS price_value
			FROM products p
			LEFT JOIN product_prices pp ON p.id = pp.product_id
			ORDER BY p.name ASC
		`)
		if err != nil {
			resultErr = err
			return err
		}
		defer rows.Close()

		productMap := make(map[string]*core.Product)
		for rows.Next() {
			var productId string
			var productName string
			var productPrice float32
			var productStockLevel float32
			var priceQuantity sql.NullInt32
			var priceValue sql.NullFloat64

			if err := rows.Scan(&productId, &productName, &productPrice, &productStockLevel, &priceQuantity, &priceValue); err != nil {
				resultErr = err
				return err
			}

			if _, exists := productMap[productId]; !exists {
				productMap[productId] = &core.Product{
					Id:             productId,
					Name:           productName,
					Price:          productPrice,
					StockLevel:     productStockLevel,
					PriceBreakdown: []core.ProductPrice{},
				}
			}

			if priceQuantity.Valid && priceValue.Valid {
				productMap[productId].PriceBreakdown = append(productMap[productId].PriceBreakdown, core.ProductPrice{
					Quantity: int(priceQuantity.Int32),
					Price:    float32(priceValue.Float64),
				})
			}
		}

		var products []core.Product
		for _, product := range productMap {
			products = append(products, *product)
		}
		result = products
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, resultErr
}

func (repo *DSqlProductRepository) ApplyMigrations(ctx context.Context) error {
	return repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		// there should be a foreign key to products table but DSQL does not currently support FK constraints
		// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility.html
		_, err := conn.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS products (
				id VARCHAR(255) PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				previous_name VARCHAR(255),
				price REAL NOT NULL,
				previous_price REAL,
				stock_level REAL,
				updated BOOLEAN DEFAULT FALSE
			);
		`)
		if err != nil {
			return err
		}
		_, err = conn.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS product_prices (
				product_id VARCHAR(255) NOT NULL,
				quantity INTEGER NOT NULL,
				price REAL NOT NULL
			);
		`)
		if err != nil {
			return err
		}

		_, err = conn.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS outbox (
				id VARCHAR(255) PRIMARY KEY,
				event_type VARCHAR(255) NOT NULL,
				event_data TEXT NOT NULL,
				trace_id VARCHAR(255) NOT NULL,
				span_id VARCHAR(255) NOT NULL,
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				processed_at TIMESTAMP NULL
			);
		`)
		if err != nil {
			return err
		}

		return nil
	})
}

func (repo *DSqlProductRepository) StoreOutboxEntry(ctx context.Context, entry core.OutboxEntry) error {
	return repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO outbox (id, event_type, event_data, trace_id, span_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, entry.Id, entry.EventType, entry.EventData, entry.TraceId, entry.SpanId, entry.CreatedAt)
		return err
	})
}

func (repo *DSqlProductRepository) GetUnprocessedEntries(ctx context.Context) ([]core.OutboxEntry, error) {
	var result []core.OutboxEntry
	var resultErr error

	err := repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		rows, err := conn.QueryContext(ctx, `
			SELECT id, event_type, event_data, trace_id, span_id, created_at, processed_at
			FROM outbox
			WHERE processed_at IS NULL
			ORDER BY created_at ASC
		`)
		if err != nil {
			resultErr = err
			return err
		}
		defer rows.Close()

		var entries []core.OutboxEntry
		for rows.Next() {
			var entry core.OutboxEntry
			if err := rows.Scan(&entry.Id, &entry.EventType, &entry.EventData, &entry.TraceId, &entry.SpanId, &entry.CreatedAt, &entry.ProcessedAt); err != nil {
				resultErr = err
				return err
			}
			entries = append(entries, entry)
		}
		result = entries
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, resultErr
}

func (repo *DSqlProductRepository) MarkAsProcessed(ctx context.Context, entryId string) error {
	return repo.executeWithRetry(ctx, func(conn *sqlx.DB) error {
		_, err := conn.ExecContext(ctx, `
			UPDATE outbox
			SET processed_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, entryId)
		return err
	})
}

func (repo *DSqlProductRepository) StoreProductWithOutboxEntry(ctx context.Context, product core.Product, outboxEntry core.OutboxEntry) error {
	return repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO products (id, name, previous_name, price, previous_price, stock_level, updated)
			VALUES ($1, $2, NULL, $3, NULL, $4, FALSE)
			ON CONFLICT (id) DO NOTHING
		`, product.Id, product.Name, product.Price, product.StockLevel)
		if err != nil {
			return err
		}

		for _, pb := range product.PriceBreakdown {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO product_prices (product_id, quantity, price)
				VALUES ($1, $2, $3)
			`, product.Id, pb.Quantity, pb.Price)
			if err != nil {
				return err
			}
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO outbox (id, event_type, event_data, trace_id, span_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, outboxEntry.Id, outboxEntry.EventType, outboxEntry.EventData, outboxEntry.TraceId, outboxEntry.SpanId, outboxEntry.CreatedAt)
		if err != nil {
			return err
		}

		return nil
	})
}

func (repo *DSqlProductRepository) UpdateProductWithOutboxEntry(ctx context.Context, product core.Product, outboxEntry core.OutboxEntry) error {
	return repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `
			UPDATE products
			SET name = $2, price = $3, stock_level = $4, updated = TRUE
			WHERE id = $1
		`, product.Id, product.Name, product.Price, product.StockLevel)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, product.Id)
		if err != nil {
			return err
		}
		for _, pb := range product.PriceBreakdown {
			_, err := tx.ExecContext(ctx, `
				INSERT INTO product_prices (product_id, quantity, price)
				VALUES ($1, $2, $3)
			`, product.Id, pb.Quantity, pb.Price)
			if err != nil {
				return err
			}
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO outbox (id, event_type, event_data, trace_id, span_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, outboxEntry.Id, outboxEntry.EventType, outboxEntry.EventData, outboxEntry.TraceId, outboxEntry.SpanId, outboxEntry.CreatedAt)
		if err != nil {
			return err
		}

		return nil
	})
}

func (repo *DSqlProductRepository) DeleteProductWithOutboxEntry(ctx context.Context, productId string, outboxEntry core.OutboxEntry) error {
	return repo.WithTransaction(ctx, func(tx *sqlx.Tx) error {
		_, err := tx.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, productId)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, productId)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO outbox (id, event_type, event_data, trace_id, span_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, outboxEntry.Id, outboxEntry.EventType, outboxEntry.EventData, outboxEntry.TraceId, outboxEntry.SpanId, outboxEntry.CreatedAt)
		if err != nil {
			return err
		}

		return nil
	})
}

func CreateOutboxEntry(ctx context.Context, eventType string, eventData interface{}) (core.OutboxEntry, error) {
	span, _ := tracer.SpanFromContext(ctx)

	traceId := ""
	spanId := ""
	if span != nil {
		spanCtx := span.Context()
		traceId = fmt.Sprintf("%d", spanCtx.TraceID())
		spanId = fmt.Sprintf("%d", spanCtx.SpanID())
	}

	eventJson, err := json.Marshal(eventData)
	if err != nil {
		return core.OutboxEntry{}, err
	}

	return core.OutboxEntry{
		Id:        uuid.New().String(),
		EventType: eventType,
		EventData: string(eventJson),
		TraceId:   traceId,
		SpanId:    spanId,
		CreatedAt: time.Now(),
	}, nil
}
