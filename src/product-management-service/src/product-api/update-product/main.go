//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"encoding/json"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"net/http"
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
	commandHandler core.UpdateProductCommandHandler
	authenticator  adapters.Authenticator
}

func NewLambdaHandler(commandHandler core.UpdateProductCommandHandler, authenticator adapters.Authenticator) *LambdaHandler {
	return &LambdaHandler{commandHandler: commandHandler, authenticator: authenticator}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	authHeader := request.Headers["Authorization"]
	if authHeader == "" {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusUnauthorized, Body: "Missing Authorization header"}, nil
	}
	claims, authError := lh.authenticator.Authenticate(ctx, authHeader)
	if authError != nil {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusUnauthorized, Body: "Unauthorized"}, nil
	}

	if claims.UserType != "ADMIN" {
		return events.APIGatewayProxyResponse{StatusCode: http.StatusForbidden, Body: "Unauthorized"}, nil
	}

	body := []byte(request.Body)

	var command core.UpdateProductCommand
	json.Unmarshal(body, &command)

	res, err := lh.commandHandler.Handle(ctx, command)

	if err != nil {
		return utils.GenerateApiResponseForError(err)
	}

	return utils.GenerateApiResponseFor(res, 200, "")
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	dynamoDbClient := dynamodb.NewFromConfig(awsCfg)
	ssmClient := ssm.NewFromConfig(awsCfg)
	snsClient := sns.NewFromConfig(awsCfg)

	secretAccessKeyParameterName := os.Getenv("JWT_SECRET_PARAM_NAME")

	secretAccessKeyParameter, err := ssmClient.GetParameter(context.Background(), &ssm.GetParameterInput{
		Name: &secretAccessKeyParameterName,
	})

	if err != nil {
		panic(err)
	}

	tableName := os.Getenv("TABLE_NAME")

	handler := NewLambdaHandler(
		*core.NewUpdateProductCommandHandler(adapters.NewDynamoDbProductRepository(*dynamoDbClient, tableName), adapters.NewSnsEventPublisher(*snsClient)),
		*adapters.NewAuthenticator(*secretAccessKeyParameter.Parameter.Value),
	)

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
