//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "TF_${var.service_name}-ddb-read-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "TF_${var.service_name}-ddb-write-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "sns_publish_create" {
  name   = "TF_${var.service_name}-publish_create-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_create.json
}

resource "aws_iam_policy" "sns_publish_update" {
  name   = "TF_${var.service_name}-publish_update-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_update.json
}

resource "aws_iam_policy" "sns_publish_delete" {
  name   = "TF_${var.service_name}-publish_delete-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_deleted.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "TF_${var.service_name}-sqs-receive-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}

resource "aws_iam_policy" "sns_publish_stock_updated" {
  name   = "TF_${var.service_name}-publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_stock_updated.json
}

resource "aws_iam_policy" "sns_publish_price_calculated" {
  name   = "TF_${var.service_name}-publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_price_calculated.json
}

resource "aws_iam_policy" "eb_publish" {
  name   = "TF_${var.service_name}-eb-publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "allow_jwt_secret_access" {
  name   = "TF_${var.service_name}-get-jwt-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_jwt_secret_key_ssm_read.json
}
