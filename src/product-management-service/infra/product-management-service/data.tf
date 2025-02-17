//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "eb_name" {
  name = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "secret_access_key_param" {
  name = "/${var.env}/shared/secret-access-key"
}

data "aws_iam_policy_document" "allow_jwt_secret_key_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
      "ssm:GetParameters"]
    resources = ["arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key"]
  }
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents"]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:event-bus/${data.aws_ssm_parameter.eb_name.value}"]
  }
}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.product_api.name}", "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.product_api.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions   = ["dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.product_api.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.product_api.name}/*"]
  }
}

data "aws_iam_policy_document" "sns_publish_create" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_created.name}"]
  }
}

data "aws_iam_policy_document" "sns_publish_update" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_updated.name}"]
  }
}

data "aws_iam_policy_document" "sns_publish_deleted" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_deleted.name}"]
  }
}

data "aws_iam_policy_document" "product_acl_queue_policy" {
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

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = ["arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.public_event_acl_queue.name}"]
  }
}

data "aws_iam_policy_document" "sns_publish_stock_updated" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_stock_level_updated.name}"]
  }
}

data "aws_iam_policy_document" "event_publisher_sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = ["arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.public_event_publisher_queue.name}"]
  }
}

data "aws_iam_policy_document" "public_event_publisher_policy" {
  statement {
    sid    = "AllowSNSPost"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.public_event_publisher_queue.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values = [aws_sns_topic.product_created.arn,
        aws_sns_topic.product_updated.arn,
        aws_sns_topic.product_deleted.arn
      ]
    }
  }
}