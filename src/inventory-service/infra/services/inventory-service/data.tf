//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.inventory_api.name}", "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.inventory_api.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions = ["dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchWriteItem",
    "dynamodb:DeleteItem",
    "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.inventory_api.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.inventory_api.name}/*"]
  }
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents"]
    resources = [
        var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.inventory_service_bus.arn
    ]
  }
  statement {
    actions   = ["events:ListEventBuses"]
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "allow_jwt_secret_key_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParameters"]
    resources = [
        var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/InventoryService/secret-access-key"
    ]
  }
}

data "aws_iam_policy_document" "allow_product_api_endpoint_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParameters"]
    resources = [
      "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter${local.product_api_endpoint_parameter_name}"
    ]
  }
}

data "aws_iam_policy_document" "retrieve_api_key_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.dd_api_key_secret_arn]
  }
}

data "aws_iam_policy_document" "stepfunctions_start_execution" {
  statement {
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.inventory_ordering_state_machine.arn]
  }
}

data "aws_iam_policy_document" "inventory_acl_queue_policy" {
  statement {
    sid    = "AllowEBPost"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.public_event_acl_queue.arn]
  }
}

data "aws_iam_policy_document" "inventory_product_created_queue_policy" {
  statement {
    sid    = "AllowEBPost"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.order_created_queue.arn]
  }
}

data "aws_iam_policy_document" "inventory_order_completed_queue_policy" {
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
    resources = [
      "arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.public_event_acl_queue.name}",
      "arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.order_created_queue.name}",
      "arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.order_completed_queue.name}"
    ]
  }
}

data "aws_iam_policy_document" "sns_publish" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.java_inventory_new_product_added.name}"]
  }
}

data "aws_secretsmanager_secret" "api_key_secret" {
  arn = var.dd_api_key_secret_arn
}