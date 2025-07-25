//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	core "github.com/datadog/serverless-sample-product-core"
	"os"
	"product-api/internal/adapters"
	"product-api/internal/utils"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	dSqlProductRepository, _ = adapters.NewDSqlProductRepository(os.Getenv("DSQL_CLUSTER_ENDPOINT"))
	createProductHandler     = core.NewCreateProductCommandHandler(dSqlProductRepository, adapters.NewSnsEventPublisher(*sns.NewFromConfig(awsCfg)))
	handler                  = core.NewListProductsQueryHandler(dSqlProductRepository)
)

func functionHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	res, err := handler.Handle(ctx, core.ListProductsQuery{})

	if err != nil {
		return utils.GenerateApiResponseForError(err)
	}

	return utils.GenerateApiResponseFor(res, 200, "")
}

func main() {

	// Seed database on first call
	_, _ = createProductHandler.Handle(context.Background(), core.CreateProductCommand{Name: "Flat White", Price: 3.5})
	_, _ = createProductHandler.Handle(context.Background(), core.CreateProductCommand{Name: "Espresso", Price: 2.99})
	_, _ = createProductHandler.Handle(context.Background(), core.CreateProductCommand{Name: "Latte", Price: 4.99})
	_, _ = createProductHandler.Handle(context.Background(), core.CreateProductCommand{Name: "Long Black", Price: 3.50})
	_, _ = createProductHandler.Handle(context.Background(), core.CreateProductCommand{Name: "Cappuccino", Price: 4.99})

	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
