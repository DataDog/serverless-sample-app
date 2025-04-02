//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package utils

import (
	"encoding/json"
	core "github.com/datadog/serverless-sample-product-core"
	"log"

	"github.com/aws/aws-lambda-go/events"
)

func GenerateApiResponseFor[T any](data T, statusCode int, message string) (events.APIGatewayProxyResponse, error) {
	if message == "" {
		message = "OK"
	}

	headers := map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
	}

	apiResponse := ApiResponse[T]{
		Data:    data,
		Message: message,
	}

	b, _ := json.Marshal(apiResponse)

	return events.APIGatewayProxyResponse{
		Body:       string(b),
		StatusCode: statusCode,
		Headers:    headers,
	}, nil
}

func GenerateApiResponseForError(err error) (events.APIGatewayProxyResponse, error) {
	_, ok := err.(*core.ProductNotFoundError)

	if ok {
		return GenerateApiResponseFor("Not found", 404, "Product not found")
	}

	_, ok = err.(*core.InvalidProductDetailsError)

	if ok {
		return GenerateApiResponseFor("OK", 400, "Invalid product details provided. Name must be 3 charachters and price greater than 0.")
	}

	_, ok = err.(*core.UpdateNotRequiredError)

	if ok {
		return GenerateApiResponseFor("OK", 200, "No updates required")
	}

	unknownError, ok := err.(*core.UnknownError)

	if ok {
		log.Fatalf("Internal error: '%s'", unknownError.Detail)
	}

	return GenerateApiResponseFor("", 500, "Unknown error")
}

type ApiResponse[T any] struct {
	Data    T      `json:"data"`
	Message string `json:"message"`
}
