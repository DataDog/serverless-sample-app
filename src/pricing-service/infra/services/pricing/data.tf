//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "sqs_receive" {
  statement {
    actions = ["sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"]
    resources = [
      aws_sqs_queue.product_created_queue.arn,
      aws_sqs_queue.product_updated_queue.arn
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
      var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/LoyaltyService/secret-access-key"
    ]
  }
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions = ["events:PutEvents", "events:DescribeEventBus"]
    resources = [
      var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.loyalty_service_bus.arn
    ]
  }
}
