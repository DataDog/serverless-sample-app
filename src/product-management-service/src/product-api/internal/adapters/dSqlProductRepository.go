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
	"github.com/aws/aws-sdk-go/aws/session"
	core "github.com/datadog/serverless-sample-product-core"
	"github.com/jackc/pgx/v5/pgxpool"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type DSqlProductRepository struct {
	authToken string
	conn      *pgxpool.Pool
}

func NewDSqlProductRepository(clusterEndpoint string) (*DSqlProductRepository, error) {
	log.Println("Cluster endpoint: ", clusterEndpoint)

	sess, err := session.NewSession()
	if err != nil {
		log.Println("Failed to create new session, returning")
		return nil, err
	}

	creds, err := sess.Config.Credentials.Get()
	if err != nil {
		log.Println("Failed to get credentials, returning")
		return nil, err
	}
	staticCredentials := credentials.NewStaticCredentials(
		creds.AccessKeyID,
		creds.SecretAccessKey,
		creds.SessionToken,
	)

	// the scheme is arbitrary and is only needed because validation of the URL requires one.
	endpoint := "https://" + clusterEndpoint
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		log.Fatalf("NewRequest failed: %v", err)
		return nil, err
	}
	values := req.URL.Query()
	values.Set("Action", "DbConnectAdmin")
	req.URL.RawQuery = values.Encode()

	signer := v4.Signer{
		Credentials: staticCredentials,
	}

	_, err = signer.Presign(req, nil, "dsql", "us-east-1", 15*time.Minute, time.Now())
	if err != nil {
		log.Fatalf("Presign failed: %v", err)
		return nil, err
	}

	token := req.URL.String()[len("https://"):]

	var sb strings.Builder
	sb.WriteString("postgres://")
	sb.WriteString(clusterEndpoint)
	sb.WriteString(":5432/postgres?user=admin&sslmode=verify-full")
	url := sb.String()

	log.Println("Full URL: ", url)

	connConfig, err := pgxpool.ParseConfig(url)

	// To avoid issues with parse config set the password directly in config
	log.Println("Connection token is: ", token)
	connConfig.ConnConfig.Password = token
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to parse config: %v\n", err)
		os.Exit(1)
	}

	log.Println("Full URL: ", connConfig.ConnConfig.ConnString())

	dbpool, err := pgxpool.NewWithConfig(context.Background(), connConfig)
	if err != nil {
		log.Printf("Unable to create connection pool: %v\n", err)
		return nil, err
	}

	log.Println("Database connection is success")

	repository := &DSqlProductRepository{
		authToken: url,
		conn:      dbpool,
	}

	err = repository.ApplyMigrations(context.Background())

	if err != nil {
		log.Println("Failed to apply migrations: ", err)
		return nil, err
	}

	return repository, nil
}

func (repo *DSqlProductRepository) Store(ctx context.Context, p core.Product) error {
	_, err := repo.conn.Exec(ctx, `
		INSERT INTO products (id, name, previous_name, price, previous_price, stock_level, updated)
		VALUES ($1, $2, NULL, $3, NULL, $4, FALSE)
		ON CONFLICT (id) DO NOTHING
	`, p.Id, p.Name, p.Price, p.StockLevel)
	if err != nil {
		return err
	}

	// Insert price brackets
	for _, pb := range p.PriceBreakdown {
		_, err := repo.conn.Exec(ctx, `
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
	_, err := repo.conn.Exec(ctx, `
		UPDATE products
		SET name = $2, price = $3, stock_level = $4, updated = TRUE
		WHERE id = $1
	`, p.Id, p.Name, p.Price, p.StockLevel)
	if err != nil {
		return err
	}

	// Remove old price brackets and insert new ones
	_, err = repo.conn.Exec(ctx, `DELETE FROM product_prices WHERE product_id = $1`, p.Id)
	if err != nil {
		return err
	}
	for _, pb := range p.PriceBreakdown {
		_, err := repo.conn.Exec(ctx, `
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
	row := repo.conn.QueryRow(ctx, `
		SELECT id, name, price, stock_level
		FROM products
		WHERE id = $1
	`, productId)

	var p core.Product
	err := row.Scan(&p.Id, &p.Name, &p.Price, &p.StockLevel)
	if err != nil {
		return nil, err
	}

	rows, err := repo.conn.Query(ctx, `
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
	_, _ = repo.conn.Exec(ctx, `DELETE FROM products WHERE id = $1`, productId)
	_, _ = repo.conn.Exec(ctx, `DELETE FROM product_prices WHERE product_id = $1`, productId)
}

func (repo *DSqlProductRepository) List(ctx context.Context) ([]core.Product, error) {
	rows, err := repo.conn.Query(ctx, `
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
		pbRows, err := repo.conn.Query(ctx, `
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
	_, err := repo.conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS products (
			id UUID PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			previous_name VARCHAR(255),
			price REAL NOT NULL,
			previous_price REAL,
			stock_level REAL,
			updated BOOLEAN DEFAULT FALSE
		);
		
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
