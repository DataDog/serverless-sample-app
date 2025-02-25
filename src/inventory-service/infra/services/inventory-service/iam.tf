//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Create a set of IAM policies our application will need
resource "aws_iam_policy" "dynamo_db_read" {
  name   = "TF_InventoryOrdering-dynamo_db_read_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_read.json
}

resource "aws_iam_policy" "dynamo_db_write" {
  name   = "TF_InventoryOrdering-dynamo_db_write_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.dynamo_db_write.json
}

resource "aws_iam_policy" "eb_publish" {
  name   = "TF_InventoryOrdering-publish-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.eb_publish.json
}

resource "aws_iam_policy" "get_api_key_secret" {
  name   = "TF_InventoryOrdering-get-secret-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.retrieve_api_key_secret.json
}

resource "aws_iam_policy" "sqs_receive_policy" {
  name   = "TF_InventoryOrdering-sqs-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sqs_receive.json
}

resource "aws_iam_policy" "sns_publish" {
  name   = "TF_InventoryOrdering-acl-sns_publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.sns_publish.json
}

resource "aws_iam_policy" "sfn_start_execution" {
  name   = "TF_InventoryOrdering-start-execution-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.stepfunctions_start_execution.json
}

resource "aws_iam_policy" "allow_jwt_secret_access" {
  name   = "TF_InventoryOrdering-jwt_secret_access-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_jwt_secret_key_ssm_read.json
}

resource "aws_iam_role" "invetory_ordering_sfn_role" {
  name = "TF_InventoryOrdering-sfn-role-${var.env}"
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
  name = "TF_InventoryOrdering-logging-policy-${var.env}"
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

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.invetory_ordering_sfn_role.id
  policy_arn = aws_iam_policy.function_logging_policy.arn
}

resource "aws_iam_role_policy_attachment" "ddb_write_policy_attachment" {
  role       = aws_iam_role.invetory_ordering_sfn_role.id
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}
