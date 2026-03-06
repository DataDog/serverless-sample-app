//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Retrieve the shared EventBridge bus name from SSM
data "aws_ssm_parameter" "shared_event_bus_name" {
  name = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "shared_event_bus_arn" {
  name = "/${var.env}/shared/event-bus-arn"
}

# SQS Dead Letter Queue for catalog sync
resource "aws_sqs_queue" "catalog_sync_dlq" {
  name                      = "ProductSearchService-catalog-sync-dlq-${var.env}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "ProductSearchService-catalog-sync-dlq-${var.env}"
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# Main SQS Queue for catalog sync with DLQ redrive
resource "aws_sqs_queue" "catalog_sync_queue" {
  name                       = "ProductSearchService-catalog-sync-queue-${var.env}"
  visibility_timeout_seconds = 174

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.catalog_sync_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "ProductSearchService-catalog-sync-queue-${var.env}"
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# SQS Queue Policy to allow EventBridge to send messages
resource "aws_sqs_queue_policy" "catalog_sync_queue_policy" {
  queue_url = aws_sqs_queue.catalog_sync_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.catalog_sync_queue.arn
      }
    ]
  })
}

# Local variables for the event subscriptions
locals {
  catalog_sync_event_subscriptions = {
    "product_created" = {
      detail_type = "product.productCreated.v1"
      source      = "${var.env}.products"
    }
    "product_updated" = {
      detail_type = "product.productUpdated.v1"
      source      = "${var.env}.products"
    }
    "product_deleted" = {
      detail_type = "product.productDeleted.v1"
      source      = "${var.env}.products"
    }
    "pricing_calculated" = {
      detail_type = "pricing.pricingCalculated.v1"
      source      = "${var.env}.pricing"
    }
    "stock_updated" = {
      detail_type = "inventory.stockUpdated.v1"
      source      = "${var.env}.inventory"
    }
  }
}

# EventBridge rules on the shared bus, routing matching events to the catalog sync SQS queue
resource "aws_cloudwatch_event_rule" "catalog_sync_event_rules" {
  for_each = local.catalog_sync_event_subscriptions

  name           = "product-search-${each.key}-${var.env}"
  description    = "Product Search Service subscription to ${each.value.detail_type} events"
  event_bus_name = data.aws_ssm_parameter.shared_event_bus_name.value

  event_pattern = jsonencode({
    detail-type = [each.value.detail_type]
    source      = [each.value.source]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
    EventType   = each.value.detail_type
  }
}

# EventBridge targets pointing each rule to the catalog sync SQS queue
resource "aws_cloudwatch_event_target" "catalog_sync_sqs_targets" {
  for_each = local.catalog_sync_event_subscriptions

  rule           = aws_cloudwatch_event_rule.catalog_sync_event_rules[each.key].name
  event_bus_name = data.aws_ssm_parameter.shared_event_bus_name.value
  target_id      = "CatalogSyncQueueTarget"
  arn            = aws_sqs_queue.catalog_sync_queue.arn
}

# SSM parameter for the search API endpoint (written after API Gateway is created)
resource "aws_ssm_parameter" "search_api_endpoint" {
  name  = "/${var.env}/ProductSearchService/api-endpoint"
  type  = "String"
  value = aws_apigatewayv2_stage.search_api_stage.invoke_url

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}
