//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_endpoint" {
  description = "HTTP API Gateway endpoint URL"
  value       = module.http_api_gateway.stage_invoke_url
}

output "api_id" {
  description = "HTTP API Gateway ID"
  value       = module.http_api_gateway.api_id
}

output "event_bus_name" {
  description = "EventBridge bus name"
  value       = aws_cloudwatch_event_bus.order_mcp_service_bus.name
}

output "event_bus_arn" {
  description = "EventBridge bus ARN"
  value       = aws_cloudwatch_event_bus.order_mcp_service_bus.arn
}

output "order_mcp_function_name" {
  description = "Order MCP server function name"
  value       = module.order_mcp_server_lambda.function_name
}

output "authorizer_function_name" {
  description = "Order MCP authorizer function name"
  value       = module.order_mcp_authorizer_lambda.function_name
}