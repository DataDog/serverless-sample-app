//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ssm_parameter" "product_added_topic" {
  name = "/dotnet/tf/${var.env}/inventory/product-added-topic"
}

data "aws_ssm_parameter" "inventory_table_name" {
  name = "/dotnet/inventory/${var.env}/table-name"
}

data "aws_iam_policy_document" "stepfunctions_start_execution" {
  statement {
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.inventory_ordering_state_machine.arn]
  }
}