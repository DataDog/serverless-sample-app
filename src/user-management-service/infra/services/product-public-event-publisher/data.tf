//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "product_created_topic_param" {
  name = "/rust/product/${var.env}/product-created-topic"
}

data "aws_ssm_parameter" "product_updated_topic_param" {
  name = "/rust/product/${var.env}/product-updated-topic"
}

data "aws_ssm_parameter" "product_deleted_topic_param" {
  name = "/rust/product/${var.env}/product-deleted-topic"
}

data "aws_ssm_parameter" "eb_name" {
  name = "/rust/shared/${var.env}/event-bus-name"
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents"]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:event-bus/${data.aws_ssm_parameter.eb_name.value}"]
  }
}

data "aws_iam_policy_document" "sqs_receive" {
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
      values = [data.aws_ssm_parameter.product_created_topic_param.value,
        data.aws_ssm_parameter.product_updated_topic_param.value,
        data.aws_ssm_parameter.product_deleted_topic_param.value
      ]
    }
  }
}
