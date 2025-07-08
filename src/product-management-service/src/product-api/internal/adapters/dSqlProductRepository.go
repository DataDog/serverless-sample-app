//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package adapters

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"time"

	core "github.com/datadog/serverless-sample-product-core"
	"github.com/jackc/pgx/v5/stdlib"

	_ "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dsql/auth"
	_ "github.com/jackc/pgx/v5/stdlib" // Keep this as the underlying driver
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

type DSqlProductRepository struct {
	conn *sqlx.DB
}

func NewDSqlProductRepository(clusterEndpoint string) (*DSqlProductRepository, error) {
	log.Println("Cluster endpoint: ", clusterEndpoint)
	sqltrace.Register("pgx", &stdlib.Driver{}, sqltrace.WithServiceName("product-api-db"))

	dbConfig := Config{
		Host:     clusterEndpoint,
		User:     "admin",
		Region:   os.Getenv("AWS_REGION"),
		Port:     "5431",
		Database: "postgres",
		Password: "",
	}

	authToken, _ := GenerateDbConnectAuthToken(context.Background(), dbConfig.Host, dbConfig.User, 15*time.Minute)

	baseURL := fmt.Sprintf("postgres://%s:5432/postgres", clusterEndpoint)

	// Parse it to add query parameters in a structured way
	connURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	// Add query parameters
	q := connURL.Query()
	q.Set("user", "admin")
	q.Set("password", authToken) // The password will be URL-encoded automatically
	q.Set("sslmode", "verify-full")
	connURL.RawQuery = q.Encode()

	db, err := sqltrace.Open("pgx", connURL.String())
	if err != nil {
		log.Printf("Unable to connect to database: %v\n", err)
		return nil, err
	}

	// Wrap with sqlx
	dbx := sqlx.NewDb(db, "pgx")

	// Set connection pool settings if needed
	dbx.SetMaxOpenConns(10)
	dbx.SetMaxIdleConns(5)
	dbx.SetConnMaxLifetime(5 * time.Minute)

	repository := &DSqlProductRepository{
		conn: dbx,
	}

	err = repository.ApplyMigrations(context.Background())

	if err != nil {
		log.Println("Failed to apply migrations: ", err)
		return nil, err
	}

	return repository, nil
}

// GenerateDbConnectAuthToken generates an authentication token for database connection
func GenerateDbConnectAuthToken(
	ctx context.Context, clusterEndpoint, user string, expiry time.Duration,
) (string, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return "", err
	}

	tokenOptions := func(options *auth.TokenOptions) {
		options.ExpiresIn = expiry
	}

	if user == "admin" {
		token, err := auth.GenerateDBConnectAdminAuthToken(ctx, clusterEndpoint, os.Getenv("AWS_REGION"), cfg.Credentials, tokenOptions)
		if err != nil {
			return "", err
		}

		return token, nil
	}

	token, err := auth.GenerateDbConnectAuthToken(ctx, clusterEndpoint, os.Getenv("AWS_REGION"), cfg.Credentials, tokenOptions)
	if err != nil {
		return "", err
	}

	return token, nil
}

func (repo *DSqlProductRepository) Store(ctx context.Context, p core.Product) error {
	_, err := repo.conn.ExecContext(ctx, `
		INSERT INTO products (id, name, previous_name, price, previous_price, stock_level, updated)
		VALUES ($1, $2, NULL, $3, NULL, $4, FALSE)
		ON CONFLICT (id) DO NOTHING
	`, p.Id, p.Name, p.Price, p.StockLevel)
	if err != nil {
		return err
	}

	// Insert price brackets
	for _, pb := range p.PriceBreakdown {
		_, err := repo.conn.ExecContext(ctx, `
			INSERT INTO product_prices (product_id, quantity, price)
			VALUES ($1, $2, $3)
		`, p.Id, pb.Quantity, pb.Price)
		if err != nil {
			return err
		}
	}
	return nil
}

func (repo *DSqlProductRepository) Update(ctx context.Context, p core.Product) error {
	_, err := repo.conn.ExecContext(ctx, `
		UPDATE products
		SET name = $2, price = $3, stock_level = $4, updated = TRUE
		WHERE id = $1
	`, p.Id, p.Name, p.Price, p.StockLevel)
	if err != nil {
		return err
	}

	// Remove old price brackets and insert new ones
	_, err = repo.conn.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, p.Id)
	if err != nil {
		return err
	}
	for _, pb := range p.PriceBreakdown {
		_, err := repo.conn.ExecContext(ctx, `
			INSERT INTO product_prices (product_id, quantity, price)
			VALUES ($1, $2, $3)
		`, p.Id, pb.Quantity, pb.Price)
		if err != nil {
			return err
		}
	}
	return nil
}

func (repo *DSqlProductRepository) Get(ctx context.Context, productId string) (*core.Product, error) {
	row := repo.conn.QueryRowContext(ctx, `
		SELECT id, name, price, stock_level
		FROM products
		WHERE id = $1
	`, productId)

	var p core.Product
	err := row.Scan(&p.Id, &p.Name, &p.Price, &p.StockLevel)
	if err != nil {
		return nil, err
	}

	rows, err := repo.conn.QueryContext(ctx, `
		SELECT quantity, price
		FROM product_prices
		WHERE product_id = $1
	`, productId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var priceBrackets []core.ProductPrice
	for rows.Next() {
		var pb core.ProductPrice
		if err := rows.Scan(&pb.Quantity, &pb.Price); err != nil {
			return nil, err
		}
		priceBrackets = append(priceBrackets, pb)
	}
	p.PriceBreakdown = priceBrackets

	return &p, nil
}

func (repo *DSqlProductRepository) Delete(ctx context.Context, productId string) {
	// Delete product and cascade deletes price brackets
	_, _ = repo.conn.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, productId)
	_, _ = repo.conn.ExecContext(ctx, `DELETE FROM product_prices WHERE product_id = $1`, productId)
}

func (repo *DSqlProductRepository) List(ctx context.Context) ([]core.Product, error) {
	rows, err := repo.conn.QueryContext(ctx, `
		SELECT id, name, price, stock_level
		FROM products
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []core.Product
	for rows.Next() {
		var p core.Product
		if err := rows.Scan(&p.Id, &p.Name, &p.Price, &p.StockLevel); err != nil {
			return nil, err
		}

		// Get price brackets for each product
		pbRows, err := repo.conn.QueryContext(ctx, `
			SELECT quantity, price
			FROM product_prices
			WHERE product_id = $1
		`, p.Id)
		if err != nil {
			return nil, err
		}
		var priceBrackets []core.ProductPrice
		for pbRows.Next() {
			var pb core.ProductPrice
			if err := pbRows.Scan(&pb.Quantity, &pb.Price); err != nil {
				pbRows.Close()
				return nil, err
			}
			priceBrackets = append(priceBrackets, pb)
		}
		pbRows.Close()
		p.PriceBreakdown = priceBrackets

		products = append(products, p)
	}
	return products, nil
}

func (repo *DSqlProductRepository) ApplyMigrations(ctx context.Context) error {
	// there should be a foreign key to products table but DSQL does not currently support FK constraints
	// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility.html
	_, err := repo.conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS products (
			id UUID PRIMARY KEY,
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
	_, err = repo.conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS product_prices (
		product_id UUID NOT NULL,
		quantity INTEGER NOT NULL,
		price REAL NOT NULL
	);
	`)
	if err != nil {
		return err
	}

	return nil
}
