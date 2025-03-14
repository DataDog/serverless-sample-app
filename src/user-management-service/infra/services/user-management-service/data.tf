//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "allow_eb_put_events" {
  statement {
    actions   = ["events:PutEvents"]
    resources = [
        var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.user_service_bus.arn
    ]
  }
}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.user_management_table.name}", "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.user_management_table.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions   = ["dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.user_management_table.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.user_management_table.name}/*"]
  }
}

data "aws_iam_policy_document" "order_completed_queue_policy" {
  statement {
    sid    = "AllowEBPost"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.order_completed_queue.arn]
  }
}

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = ["arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.order_completed_queue.name}"]
  }
}

data "aws_iam_policy_document" "allow_jwt_secret_key_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParameters"]
    resources = [
        var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/UserManagement/secret-access-key"
    ]
  }
}