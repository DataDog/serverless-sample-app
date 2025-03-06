//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "tf-orders-dynamo_db_read_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "tf-orders-api-dynamo_db_write_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "eb_publish" {
  name   = "tf-orders-api-publish-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "step_functions_interactions" {
  name   = "tf-orders-api-step-function-interactions-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.step_function_interactions.json
}

resource "aws_iam_policy" "order_workflow_function_invoke" {
  name   = "tf-orders-order_workflow_function_invoke-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.order_workflow_lambda_invoke.json
}

resource "aws_iam_policy" "get_api_key_secret" {
  name   = "tf-orders-api-get-secret-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.retrieve_api_key_secret.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "TF_OrdersService-sqs-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}