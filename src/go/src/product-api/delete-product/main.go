//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"os"
	"product-api/internal/adapters"
	"product-api/internal/core"
	"product-api/internal/utils"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/sns"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
)

type LambdaHandler struct {
	deleteProductCommandHandler core.DeleteProductCommandHandler
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	productId := request.PathParameters["productId"]

	lh.deleteProductCommandHandler.Handle(ctx, core.DeleteProductCommand{ProductId: productId})

	return utils.GenerateApiResponseFor("OK", 200, "")
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	dynamoDbClient := dynamodb.NewFromConfig(awsCfg)
	snsClient := sns.NewFromConfig(awsCfg)

	tableName := os.Getenv("TABLE_NAME")

	handler := LambdaHandler{
		deleteProductCommandHandler: *core.NewDeleteProductCommandHandler(adapters.NewDynamoDbProductRepository(*dynamoDbClient, tableName), adapters.NewSnsEventPublisher(*snsClient)),
	}

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
