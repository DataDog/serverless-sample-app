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
	"inventory-api/src/core"
	"inventory-api/src/core/domain"
	"log"

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

func (repo *DynamoDbProductRepository) Store(ctx context.Context, inventoryItem *domain.InventoryItem) error {
	item := Item{
		PK:         inventoryItem.ProductId,
		ProductId:  inventoryItem.ProductId,
		StockLevel: inventoryItem.StockLevel,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		log.Fatalf("Got error marshalling inventory item: %s", err)
		return &core.UnknownError{Detail: fmt.Sprintf("Got error marshalling inventory item: %s", err)}
	}

	input := &dynamodb.PutItemInput{
		Item:      av,
		TableName: aws.String(repo.tableName),
	}

	_, err = repo.client.PutItem(ctx, input)

	fmt.Println("Successfully added '" + item.ProductId + " to table " + repo.tableName)

	return nil
}

func (repo *DynamoDbProductRepository) WithProductId(ctx context.Context, id string) (*domain.InventoryItem, error) {
	result, err := repo.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(repo.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: id},
		},
	})

	if err != nil {
		return nil, &core.UnknownError{Detail: fmt.Sprintf("Got error calling GetItem: %s", err)}
	}

	if result.Item == nil {
		return nil, &core.ProductNotFoundError{ProductId: id}
	}

	item := Item{}

	err = attributevalue.UnmarshalMap(result.Item, &item)

	if err != nil {
		panic(fmt.Sprintf("Failed to unmarshal Record, %v", err))
	}

	return &domain.InventoryItem{
		ProductId:  item.ProductId,
		StockLevel: item.StockLevel,
	}, nil
}

type Item struct {
	PK         string
	ProductId  string
	StockLevel int
}
