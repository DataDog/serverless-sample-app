//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "product_pricing_changed_topic" {
  name = "/java/tf/${var.env}/product/pricing-calculated-topic"
}

data "aws_ssm_parameter" "product_pricing_changed_topic_name" {
  name = "/java/tf/${var.env}/product/pricing-calculated-topic-name"
}

data "aws_ssm_parameter" "product_api_table_name" {
  name = "/java/tf/${var.env}/product/table-name"
}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${data.aws_ssm_parameter.product_api_table_name.value}", "arn:aws:dynamodb:*:*:table/${data.aws_ssm_parameter.product_api_table_name.value}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions = ["dynamodb:PutItem",
      "dynamodb:UpdateItem",
    "dynamodb:BatchWriteItem"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${data.aws_ssm_parameter.product_api_table_name.value}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${data.aws_ssm_parameter.product_api_table_name.value}/*"]
  }
}
