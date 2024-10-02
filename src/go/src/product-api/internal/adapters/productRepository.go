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
	"product-api/internal/core"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type DynamoDbProductRepository struct {
	client    dynamodb.Client
	tableName string
}

func NewDynamoDbProductRepository(client dynamodb.Client, tableName string) *DynamoDbProductRepository {
	return &DynamoDbProductRepository{client: client, tableName: tableName}
}

func (repo *DynamoDbProductRepository) Store(ctx context.Context, p core.Product) error {
	item := Item{
		PK:            p.Id,
		Type:          "Product",
		Name:          p.Name,
		Price:         p.Price,
		ProductId:     p.Id,
		PriceBrackets: p.PriceBreakdown,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		log.Fatalf("Got error marshalling new movie item: %s", err)
		return &core.UnknownError{Detail: fmt.Sprintf("Got error marshalling new movie item: %s", err)}
	}

	input := &dynamodb.PutItemInput{
		Item:      av,
		TableName: aws.String(repo.tableName),
	}

	_, err = repo.client.PutItem(ctx, input)

	fmt.Println("Successfully added '" + item.Name + " to table " + repo.tableName)

	return nil
}

func (repo *DynamoDbProductRepository) Update(ctx context.Context, p core.Product) error {
	item := Item{
		PK:            p.Id,
		Type:          "Product",
		Name:          p.Name,
		Price:         p.Price,
		ProductId:     p.Id,
		PriceBrackets: p.PriceBreakdown,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		log.Fatalf("Got error marshalling new movie item: %s", err)
		return &core.UnknownError{Detail: fmt.Sprintf("Got error marshalling new movie item: %s", err)}
	}

	input := &dynamodb.PutItemInput{
		Item:      av,
		TableName: aws.String(repo.tableName),
	}

	_, err = repo.client.PutItem(ctx, input)

	fmt.Println("Successfully added '" + item.Name + " to table " + repo.tableName)

	return nil
}

func (repo *DynamoDbProductRepository) Get(ctx context.Context, productId string) (*core.Product, error) {
	result, err := repo.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(repo.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: productId},
		},
	})

	if err != nil {
		return nil, &core.UnknownError{Detail: fmt.Sprintf("Got error calling GetItem: %s", err)}
	}

	if result.Item == nil {
		return nil, &core.ProductNotFoundError{ProductId: productId}
	}

	item := Item{}

	err = attributevalue.UnmarshalMap(result.Item, &item)

	if err != nil {
		panic(fmt.Sprintf("Failed to unmarshal Record, %v", err))
	}

	return &core.Product{
		Id:             item.ProductId,
		Name:           item.Name,
		Price:          item.Price,
		PriceBreakdown: item.PriceBrackets,
	}, nil
}

func (repo *DynamoDbProductRepository) Delete(ctx context.Context, productId string) {
	repo.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(repo.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: productId},
		},
	})
}

func (repo *DynamoDbProductRepository) List(ctx context.Context) ([]core.Product, error) {
	items, err := repo.client.Scan(ctx, &dynamodb.ScanInput{
		TableName: aws.String(repo.tableName),
	})

	if err != nil {
		panic(fmt.Sprintf("Failed to unmarshal Record, %v", err))
		return nil, &core.UnknownError{Detail: fmt.Sprintf("Got error marshalling new movie item: %s", err)}
	}

	products := []core.Product{}

	for _, element := range items.Items {
		item := Item{}

		attributevalue.UnmarshalMap(element, &item)

		products = append(products, core.Product{
			Id:             item.ProductId,
			Name:           item.Name,
			Price:          item.Price,
			PriceBreakdown: item.PriceBrackets,
		})
	}

	return products, nil
}

type Item struct {
	PK            string
	Type          string
	Name          string
	Price         float32
	ProductId     string
	PriceBrackets []core.ProductPrice
}
