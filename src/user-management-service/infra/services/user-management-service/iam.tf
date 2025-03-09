//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "TF_Users-ddb-read-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "TF_Users-ddb-write-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "sns_publish_create" {
  name   = "TF_Users-sns_publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish_create.json
}

resource "aws_iam_policy" "eb_publish" {
  name   = "TF_Users-db_publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_eb_put_events.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "TF_Users-sqs-receive-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}

resource "aws_iam_policy" "allow_jwt_secret_access" {
  name   = "TF_Users-get-jwt-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_jwt_secret_key_ssm_read.json
}