//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "order_mcp_api_endpoint" {
  description = "Order MCP service API endpoint"
  value       = module.order_mcp.api_endpoint
}

output "order_mcp_event_bus_name" {
  description = "Order MCP service EventBridge bus name"
  value       = module.order_mcp.event_bus_name
}

output "order_mcp_event_bus_arn" {
  description = "Order MCP service EventBridge bus ARN"
  value       = module.order_mcp.event_bus_arn
}