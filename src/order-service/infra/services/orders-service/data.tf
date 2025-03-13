//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_iam_policy_document" "step_function_interactions" {
  statement {
    actions   = ["states:StartExecution", "states:SendTaskSuccess", "states:SendTaskFailure"]
    resources = [aws_sfn_state_machine.order_workflow_state_machine.arn]
  }
}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = [
      "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.orders_api.name}",
      "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.orders_api.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions = ["dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.orders_api.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.orders_api.name}/*"]
  }
}
data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents", "events:DescribeEventBus"]
    resources = [
        var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.orders_service_bus.arn
    ]
  }
}

data "aws_iam_policy_document" "allow_jwt_secret_key_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParameters"]
    resources = [
        var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/OrdersService/secret-access-key"
    ]
  }
}

data "aws_iam_policy_document" "retrieve_api_key_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.dd_api_key_secret_arn]
  }
}

data "aws_iam_policy_document" "eb_queue_policy" {
  statement {
    sid    = "AllowEBPost"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.stock_reserved_queue.arn, aws_sqs_queue.stock_reservation_failed_queue.arn]
  }
}

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"]
    resources = [
      aws_sqs_queue.stock_reserved_queue.arn,
      aws_sqs_queue.stock_reservation_failed_queue.arn,
    ]
  }
}

data "aws_iam_policy_document" "order_workflow_lambda_invoke" {
  statement {
    actions = ["lambda:InvokeFunction"]
    resources = [
      module.no_stock_handler.function_arn,
      module.confirm_order_handler.function_arn
    ]
  }
}

data "aws_secretsmanager_secret" "api_key_secret" {
  arn = var.dd_api_key_secret_arn
}