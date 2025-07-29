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
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	core "github.com/datadog/serverless-sample-product-core"
	"os"
	"product-api/internal/adapters"
	"product-api/internal/utils"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	awscfg "github.com/aws/aws-sdk-go-v2/config"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	dSqlProductRepository, _ = adapters.NewDSqlProductRepository(os.Getenv("DSQL_CLUSTER_ENDPOINT"))
	handler                  = core.NewDeleteProductCommandHandler(
		dSqlProductRepository,
		dSqlProductRepository)
	authenticator = adapters.NewAuthenticator(context.Background(), *ssm.NewFromConfig(awsCfg))
)

func functionHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_, err := authenticator.AuthenticateAPIGatewayRequest(ctx, request, "ADMIN")

	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 401, Body: "Unauthorized"}, nil
	}

	productId := request.PathParameters["productId"]

	handler.Handle(ctx, core.DeleteProductCommand{ProductId: productId})

	return utils.GenerateApiResponseFor("OK", 200, "")
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
