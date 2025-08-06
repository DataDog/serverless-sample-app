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
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"

	"product-api/internal/adapters"

	core "github.com/datadog/serverless-sample-product-core"

	observability "github.com/datadog/serverless-sample-observability"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	dSqlProductRepository, _ = adapters.NewDSqlProductRepository(os.Getenv("DSQL_CLUSTER_ENDPOINT"))
	handler                  = core.NewPricingUpdatedEventHandler(
		dSqlProductRepository)
)

func functionHandler(ctx context.Context, request events.SNSEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	for index := range request.Records {
		record := request.Records[index]

		err := processMessage(ctx, record)

		if err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			println(err.Error())
			panic(err.Error())
		}
	}
}

func processMessage(ctx context.Context, record events.SNSEventRecord) error {
	body := []byte(record.SNS.Message)

	var evt observability.CloudEvent[core.PriceCalculatedEvent]
	jsonErr := json.Unmarshal(body, &evt)

	if jsonErr != nil {
		return jsonErr
	}

	span, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type))
	defer span.Finish()

	span.SetTag("product.id", evt.Data.ProductId)
	span.SetTag("product.priceCount", len(evt.Data.PriceBrackets))
	span.SetTag("messaging.message.id", evt.Id)
	span.SetTag("messaging.message.type", evt.Type)
	span.SetTag("messaging.message.envelope.size", len(record.SNS.Message))
	span.SetTag("messaging.operation.name", "process")
	span.SetTag("messaging.operation.type", "process")
	span.SetTag("messaging.system", "aws_sns")

	_, err := handler.Handle(ctx, evt.Data)

	return err
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
