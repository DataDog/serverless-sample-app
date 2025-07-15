//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_cloudwatch_event_bus" "order_mcp_service_bus" {
  name = "OrderMcpService-bus-${var.env}"
  
  tags = {
    Environment = var.env
    Service     = "OrderMcpService"
    Version     = var.app_version
  }
}

resource "aws_ssm_parameter" "order_mcp_event_bus_arn" {
  name  = "/${var.env}/OrderMcpService/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.order_mcp_service_bus.arn
  
  tags = {
    Environment = var.env
    Service     = "OrderMcpService"
    Version     = var.app_version
  }
}

resource "aws_ssm_parameter" "order_mcp_event_bus_name" {
  name  = "/${var.env}/OrderMcpService/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.order_mcp_service_bus.name
  
  tags = {
    Environment = var.env
    Service     = "OrderMcpService"
    Version     = var.app_version
  }
}

# For non-integrated environments, use local bus; for integrated, use shared bus
data "aws_ssm_parameter" "shared_eb_name" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "/${var.env}/shared/event-bus-name"
}

# Create rule to forward events from shared bus to local bus in integrated environments
resource "aws_cloudwatch_event_rule" "shared_to_local_rule" {
  count           = var.env == "dev" || var.env == "prod" ? 1 : 0
  name            = "OrderMcpService-shared-to-local-${var.env}"
  description     = "Forward events from shared bus to OrderMcpService local bus"
  event_bus_name  = data.aws_ssm_parameter.shared_eb_name[0].value
  
  # This would need to be customized based on the specific event patterns needed
  event_pattern = jsonencode({
    source = ["orders", "users", "products"]
  })
}

resource "aws_cloudwatch_event_target" "shared_to_local_target" {
  count          = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_to_local_rule[0].name
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[0].value
  target_id      = "OrderMcpServiceLocalBus"
  arn            = aws_cloudwatch_event_bus.order_mcp_service_bus.arn
  role_arn       = aws_iam_role.event_bridge_role[0].arn
}

resource "aws_iam_role" "event_bridge_role" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "OrderMcpService-EventBridge-Role-${var.env}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "event_bridge_policy" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "OrderMcpService-EventBridge-Policy-${var.env}"
  role  = aws_iam_role.event_bridge_role[0].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.order_mcp_service_bus.arn
      }
    ]
  })
}