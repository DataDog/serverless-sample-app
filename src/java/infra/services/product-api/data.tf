//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_product_api.name}", "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.java_product_api.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions   = ["dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_product_api.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_product_api.name}/*"]
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

data "aws_iam_policy_document" "sns_list_topics" {
  statement {
    actions   = ["sns:ListTopics"]
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "retrieve_api_key_secret" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.dd_api_key_secret_arn]
  }
}

data "aws_secretsmanager_secret" "api_key_secret" {
  arn = var.dd_api_key_secret_arn
}

data "aws_secretsmanager_secret_version" "current_api_key_secret" {
  secret_id = data.aws_secretsmanager_secret.api_key_secret.id
}