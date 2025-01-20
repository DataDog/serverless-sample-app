//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_policy" "sfn_start_execution" {
  name   = "tf-dotnet-inventory-ordering-service-start-execution-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.stepfunctions_start_execution.json
}

resource "aws_iam_role" "invetory_ordering_sfn_role" {
  name = "tf-dotnet-inventory-ordering-service-sfn-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "function_logging_policy" {
  name = "tf-dotnet-inventory-ordering-service-logging-policy-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "logs:CreateLogDelivery",
          "logs:CreateLogStream",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ],
        Effect : "Allow",
        Resource : "*"
      }
    ]
  })
}

resource "aws_iam_policy" "ddb_write_policy" {
  name = "tf-node-inventory-ordering-service-db-write-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "dynamodb:PutItem"
        ],
        Effect : "Allow",
        Resource : "arn:aws:dynamodb:*:${data.aws_caller_identity.current.account_id}:table/${data.aws_ssm_parameter.inventory_table_name.value}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.invetory_ordering_sfn_role.id
  policy_arn = aws_iam_policy.function_logging_policy.arn
}

resource "aws_iam_role_policy_attachment" "ddb_write_policy_attachment" {
  role       = aws_iam_role.invetory_ordering_sfn_role.id
  policy_arn = aws_iam_policy.ddb_write_policy.arn
}
