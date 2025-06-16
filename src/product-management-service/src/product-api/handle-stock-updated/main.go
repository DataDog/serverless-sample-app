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

	observability "github.com/datadog/serverless-sample-observability"
	core "github.com/datadog/serverless-sample-product-core"

	"product-api/internal/adapters"

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
	handler                  = core.NewProductStockUpdatedEventHandler(
		dSqlProductRepository)
)

func functionHandler(ctx context.Context, request events.SNSEvent) {
	span, _ := tracer.SpanFromContext(ctx)
	defer span.Finish()

	for index := range request.Records {
		record := request.Records[index]

		fmt.Printf("SNS message body is %s", record.SNS.Message)

		body := []byte(record.SNS.Message)

		var evt observability.CloudEvent[core.StockUpdatedEvent]
		json.Unmarshal(body, &evt)

		span, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type))

		_, err := handler.Handle(ctx, evt.Data)

		span.Finish()

		if err != nil {
			println(err.Error())
		}
	}
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
