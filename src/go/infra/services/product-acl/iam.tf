//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "tfgo-product-acl-sqs-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}

resource "aws_iam_policy" "sns_publish" {
  name   = "tfgo-product-acl-sns_publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish.json
}