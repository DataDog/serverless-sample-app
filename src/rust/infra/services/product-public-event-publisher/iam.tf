//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_policy" "eb_publish" {
  name   = "product-event-publisher-publish-policy"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "product-event-publisher-sqs-policy"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}