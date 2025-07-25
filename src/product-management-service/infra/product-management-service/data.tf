//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "allow_jwt_secret_key_ssm_read" {
  statement {
    actions = ["ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameterHistory",
    "ssm:GetParameters"]
    resources = [
      var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/${var.service_name}/secret-access-key"
    ]
  }
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions = ["events:PutEvents", "events:DescribeEventBus"]
    resources = [
      var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.product_service_bus.arn
    ]
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

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = [
      aws_sqs_queue.public_event_acl_queue.arn,
      aws_sqs_queue.public_pricing_updated_queue.arn,
      aws_sqs_queue.public_event_publisher_queue.arn,
    ]
  }
}

data "aws_iam_policy_document" "sns_publish_stock_updated" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_stock_level_updated.name}"]
  }
}

data "aws_iam_policy_document" "sns_publish_price_calculated" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_price_calculated.name}"]
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

data "aws_iam_policy_document" "dsql_connect_policy" {
  statement {
    sid    = "AllowDSQLConnect"
    effect = "Allow"

    actions   = ["dsql:DbConnectAdmin"]
    resources = [aws_dsql_cluster.product_api_dsql.arn]
  }
}
