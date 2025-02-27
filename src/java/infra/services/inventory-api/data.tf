//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_iam_policy_document" "dynamo_db_read" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_inventory_api.name}", "arn:aws:dynamodb:*:*:table/${aws_dynamodb_table.java_inventory_api.name}/*"]
  }
}

data "aws_iam_policy_document" "dynamo_db_write" {
  statement {
    actions = ["dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchWriteItem",
    "dynamodb:DeleteItem",
    "dynamodb:DescribeTable"]
    resources = ["arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_inventory_api.name}", "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.java_inventory_api.name}/*"]
  }
}

data "aws_ssm_parameter" "eb_name" {
  name = "/java/tf/${var.env}/shared/event-bus-name"
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents", "events:ListEventBuses"]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:event-bus/${data.aws_ssm_parameter.eb_name.value}"]
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