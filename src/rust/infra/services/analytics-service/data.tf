//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "eb_name" {
  name = "/rust/shared/event-bus-name"
}

data "aws_iam_policy_document" "analytics_service_queue_policy" {
  statement {
    sid    = "AllowSQSSend"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.analytics_service_queue.arn]
  }
}

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = ["arn:aws:sqs:*:${data.aws_caller_identity.current.account_id}:${aws_sqs_queue.analytics_service_queue.name}"]
  }
}