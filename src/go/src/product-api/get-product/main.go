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

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
)

type LambdaHandler struct {
	queryHandler core.GetProductQueryHandler
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	productId := request.PathParameters["productId"]

	res, err := lh.queryHandler.Handle(ctx, core.GetProductQuery{ProductId: productId})

	if err != nil {
		return utils.GenerateApiResponseForError(err)
	}

	return utils.GenerateApiResponseFor(res, 200, "")
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	dynamoDbClient := dynamodb.NewFromConfig(awsCfg)

	tableName := os.Getenv("TABLE_NAME")

	handler := LambdaHandler{
		queryHandler: *core.NewGetProductQueryHandler(adapters.NewDynamoDbProductRepository(*dynamoDbClient, tableName)),
	}

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
