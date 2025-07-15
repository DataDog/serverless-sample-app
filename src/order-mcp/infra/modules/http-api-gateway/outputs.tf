//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_id" {
  description = "ID of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.http_api.id
}

output "api_arn" {
  description = "ARN of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.http_api.arn
}

output "api_endpoint" {
  description = "Endpoint URL of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "stage_invoke_url" {
  description = "Invoke URL of the HTTP API Gateway stage"
  value       = aws_apigatewayv2_stage.default.invoke_url
}