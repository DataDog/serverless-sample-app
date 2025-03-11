//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "eb_publish" {
  name   = "tf-pricing-publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "get_jwt_ssm_parameter" {
  name   = "tf-pricing-get-jwt-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_jwt_secret_key_ssm_read.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "tf-pricing-sqs-receive-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}
