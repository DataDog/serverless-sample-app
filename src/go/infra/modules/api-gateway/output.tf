//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_id" {
  value = aws_apigatewayv2_api.lambda.id
}

output "api_arn" {
  value = aws_apigatewayv2_api.lambda.execution_arn
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.lambda.api_endpoint
}
