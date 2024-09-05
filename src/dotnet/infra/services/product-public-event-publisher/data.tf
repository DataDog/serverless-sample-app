//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "product_created_topic_param" {
  name = "/dotnet/product/product-created-topic"
}

data "aws_ssm_parameter" "product_updated_topic_param" {
  name = "/dotnet/product/product-updated-topic"
}

data "aws_ssm_parameter" "product_deleted_topic_param" {
  name = "/dotnet/product/product-deleted-topic"
}

data "aws_ssm_parameter" "eb_name" {
  name = "/dotnet/shared/event-bus-name"
}

data "aws_iam_policy_document" "eb_publish" {
  statement {
    actions   = ["events:PutEvents"]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:event-bus/${data.aws_ssm_parameter.eb_name.value}"]
  }
}
