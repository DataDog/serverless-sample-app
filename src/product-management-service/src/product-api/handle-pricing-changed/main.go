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

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	handler = core.NewPricingUpdatedEventHandler(
		adapters.NewDynamoDbProductRepository(*dynamodb.NewFromConfig(awsCfg), os.Getenv("TABLE_NAME")))
)

func functionHandler(ctx context.Context, request events.SNSEvent) {
	for index := range request.Records {
		record := request.Records[index]

		fmt.Printf("SNS message body is %s", record.SNS.Message)

		body := []byte(record.SNS.Message)

		var evt observability.CloudEvent[core.PriceCalculatedEvent]
		json.Unmarshal(body, &evt)

		span, _ := tracer.StartSpanFromContext(ctx, "process product.pricingChanged")

		_, err := handler.Handle(ctx, evt.Data)

		span.Finish()

		if err != nil {
			println(err.Error())
			panic(err.Error())
		}
	}
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
