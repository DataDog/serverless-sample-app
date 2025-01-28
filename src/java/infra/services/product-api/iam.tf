//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "java-tf-product-api-dynamo_db_read_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "java-tf-product-api-dynamo_db_write_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "sns_publish_create" {
  name   = "java-tf-product-api-sns_publish_create_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_create.json
}

resource "aws_iam_policy" "sns_publish_update" {
  name   = "java-tf-product-api-sns_publish_update_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_update.json
}

resource "aws_iam_policy" "sns_publish_delete" {
  name   = "java-tf-product-api-sns_publish_delete_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_deleted.json
}

resource "aws_iam_policy" "get_api_key_secret" {
  name   = "tf-java-product-api-get-secret-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.retrieve_api_key_secret.json
}

