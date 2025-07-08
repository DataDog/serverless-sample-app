//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_role" "lambda_function_role" {
  name = "tf-python-${var.function_name}-lambda-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

// Basic execution role for Lambda
resource "aws_iam_policy" "function_basic_execution_policy" {
  name = "TF-${var.service_name}-${var.function_name}-${var.env}-basic-execution-policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect : "Allow",
        Resource : "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_policy" "dd_api_secret_policy" {
  name = "tf-python-${var.function_name}-api-key-secret-policy-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "secretsmanager:GetSecretValue"
        ],
        Effect : "Allow",
        Resource : var.dd_api_key_secret_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "function_basic_execution_policy_attachment" {
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = aws_iam_policy.function_basic_execution_policy.arn
}

resource "aws_iam_role_policy_attachment" "secrets_retrieval_policy_attachment" {
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = aws_iam_policy.dd_api_secret_policy.arn
}

resource "aws_iam_role_policy_attachment" "additional_policy_attachments" {
  count      = length(var.additional_policy_attachments)
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = var.additional_policy_attachments[count.index]
}

resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/tf-python-${var.function_name}-${var.env}"
  retention_in_days = 1
  lifecycle {
    prevent_destroy = false
  }
}

# Create common layer if layer_zip_file is provided
resource "aws_lambda_layer_version" "common_layer" {
  count               = var.layer_zip_file != null ? 1 : 0
  filename            = var.layer_zip_file
  layer_name          = "tf-python-${var.service_name}-common-${var.env}"
  compatible_runtimes = ["python3.13"]
  source_code_hash    = var.layer_zip_file != null ? filebase64sha256(var.layer_zip_file) : null

  description = "Common dependencies layer for ${var.service_name}"
}

# Lambda function using Datadog module
module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "3.1.0"

  filename                 = var.zip_file
  function_name            = "tf-python-${var.function_name}-${var.env}"
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = var.lambda_handler
  runtime                  = "python3.13"
  memory_size              = var.memory_size
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash         = filebase64sha256(var.zip_file)
  timeout                  = var.function_timeout
  layers                   = var.layer_zip_file != null ? concat([aws_lambda_layer_version.common_layer[0].arn], var.additional_layers) : var.additional_layers

  environment_variables = merge(tomap({
    "TEAM" : "activity"
    "DOMAIN" : "activity"
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_EXTENSION_VERSION" : "next"
    "DD_CAPTURE_LAMBDA_PAYLOAD" : "true"
    "DD_LOGS_INJECTION" : "true"
    "DD_ENV" : var.env
    "DD_SERVICE" : var.service_name
    "DD_SITE" : var.dd_site
    "DD_VERSION" : var.app_version
    "BUILD_ID" : var.app_version
    "DD_DATA_STREAMS_ENABLED"                           = "true"
    "DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED" = "true"
    "DEPLOYED_AT" : timestamp()
    "ENV" : var.env
    "POWERTOOLS_SERVICE_NAME" : var.service_name
    "POWERTOOLS_LOG_LEVEL" : "INFO"
    }),
    var.environment_variables
  )

  datadog_extension_layer_version = 82
  datadog_python_layer_version    = 110
}
