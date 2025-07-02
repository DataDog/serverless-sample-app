//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Activity Service EventBridge bus
resource "aws_cloudwatch_event_bus" "activity_service_bus" {
  name = "ActivityService-events-${var.env}"

  tags = {
    Name        = "ActivityService-events-${var.env}"
    Environment = var.env
    Service     = "ActivityService"
  }
}

# SSM parameters for event bus
resource "aws_ssm_parameter" "event_bus_name" {
  name  = "/${var.env}/ActivityService/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.activity_service_bus.name

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

resource "aws_ssm_parameter" "event_bus_arn" {
  name  = "/${var.env}/ActivityService/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.activity_service_bus.arn

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# Get shared event bus information for integrated environments
data "aws_ssm_parameter" "shared_eb_name" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "shared_eb_arn" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "/${var.env}/shared/event-bus-arn"
}

# SQS Dead Letter Queue
resource "aws_sqs_queue" "activity_dead_letter_queue" {
  name                      = "ActivityService-activity-dlq-${var.env}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "ActivityService-activity-dlq-${var.env}"
    Environment = var.env
    Service     = "ActivityService"
  }
}

# Main SQS Queue with DLQ configuration
resource "aws_sqs_queue" "activity_queue" {
  name = "ActivityService-activity-queue-${var.env}"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.activity_dead_letter_queue.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "ActivityService-activity-queue-${var.env}"
    Environment = var.env
    Service     = "ActivityService"
  }
}

# SQS Queue Policy to allow EventBridge to send messages
resource "aws_sqs_queue_policy" "activity_queue_policy" {
  queue_url = aws_sqs_queue.activity_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.activity_queue.arn
      }
    ]
  })
}

# Local event variables for reuse
locals {
  event_types = [
    "product.productCreated.v1",
    "product.productUpdated.v1",
    "product.productDeleted.v1",
    "users.userCreated.v1",
    "orders.orderCreated.v1",
    "orders.orderConfirmed.v1",
    "orders.orderCompleted.v1",
    "inventory.stockUpdated.v1",
    "inventory.stockReserved.v1",
    "inventory.stockReservationFailed.v1"
  ]
}

# EventBridge rules for local event bus
resource "aws_cloudwatch_event_rule" "activity_local_event_rules" {
  for_each = toset(local.event_types)

  name           = "activity_${replace(each.value, ".", "_")}-${var.env}"
  description    = "Activity Service subscription to ${each.value} events"
  event_bus_name = aws_cloudwatch_event_bus.activity_service_bus.name

  event_pattern = jsonencode({
    detail-type = [each.value]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
    EventType   = each.value
  }
}

# Event targets for local rules
resource "aws_cloudwatch_event_target" "activity_local_sqs_targets" {
  for_each = toset(local.event_types)

  rule           = aws_cloudwatch_event_rule.activity_local_event_rules[each.value].name
  event_bus_name = aws_cloudwatch_event_bus.activity_service_bus.name
  target_id      = "ActivityQueueTarget"
  arn            = aws_sqs_queue.activity_queue.arn
}

# IAM role for shared event bus to activity service event bus forwarding
resource "aws_iam_role" "shared_event_bus_to_activity_service_event_bus_role" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "SharedEventBusToActivityServiceEventBusRole-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  inline_policy {
    name = "allow-eb-publish"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "events:PutEvents"
          ]
          Resource = [aws_cloudwatch_event_bus.activity_service_bus.arn]
        }
      ]
    })
  }

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# EventBridge rules for shared event bus (only for integrated environments)
resource "aws_cloudwatch_event_rule" "activity_shared_event_rules" {
  for_each = var.env == "dev" || var.env == "prod" ? toset(local.event_types) : toset([])

  name           = "shared_activity_${replace(each.value, ".", "_")}-${var.env}"
  description    = "Activity Service subscription to ${each.value} events from shared bus"
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[0].value

  event_pattern = jsonencode({
    detail-type = [each.value]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
    EventType   = each.value
    Source      = "SharedBus"
  }
}

# Event targets for shared bus rules (forward to activity service bus)
resource "aws_cloudwatch_event_target" "activity_shared_bus_targets" {
  for_each = var.env == "dev" || var.env == "prod" ? toset(local.event_types) : toset([])

  rule           = aws_cloudwatch_event_rule.activity_shared_event_rules[each.value].name
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[0].value
  target_id      = "ActivityServiceEventBus"
  arn            = aws_cloudwatch_event_bus.activity_service_bus.arn
  role_arn       = aws_iam_role.shared_event_bus_to_activity_service_event_bus_role[0].arn
}