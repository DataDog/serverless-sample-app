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

data "aws_iam_policy_document" "sns_publish" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:*:${data.aws_caller_identity.current.account_id}:${aws_sns_topic.product_price_calculated.name}"]
  }
}