//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "ProductManagementService-dynamo_db_read_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "ProductManagementService-dynamo_db_write_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "sns_publish_create" {
  name   = "ProductManagementService-sns_publish_create_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_create.json
}

resource "aws_iam_policy" "sns_publish_update" {
  name   = "ProductManagementService-sns_publish_update_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_update.json
}

resource "aws_iam_policy" "sns_publish_delete" {
  name   = "ProductManagementService-sns_publish_delete_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_deleted.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "ProductManagementService-acl-sqs-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}

resource "aws_iam_policy" "sns_publish_stock_updated" {
  name   = "ProductManagementService-publish_stock_updated-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_stock_updated.json
}

resource "aws_iam_policy" "eb_publish" {
  name   = "ProductManagementService-event-publisher-publish-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "event_publisher_sqs_receive_policy" {
  name   = "ProductManagementService-event-publisher-sqs-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.event_publisher_sqs_receive.json
}

resource "aws_iam_policy" "allow_jwt_secret_access" {
  name   = "ProductManagementService-jwt_secret_access-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_jwt_secret_key_ssm_read.json
}
