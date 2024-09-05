//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_role" "lambda_function_role" {
  name = "${var.function_name}-lambda-role"
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

resource "aws_iam_policy" "function_logging_policy" {
  name = "${var.function_name}-${var.env}-logging-policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
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
  name = "${var.function_name}-${var.env}-api-key-secret-policy"
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


resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = aws_iam_policy.function_logging_policy.arn
}
resource "aws_iam_role_policy_attachment" "secrets_retrieval_policy_attachment" {
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = aws_iam_policy.dd_api_secret_policy.arn
}

resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/Dotnet-${var.function_name}-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}

module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "1.4.0"

  filename                 = var.publish_directory
  function_name            = "Dotnet-${var.function_name}-${var.env}"
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = var.lambda_handler
  runtime                  = "dotnet8"
  memory_size              = var.memory_size
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash         = base64sha256(filebase64(var.publish_directory))
  timeout                  = var.timeout

  environment_variables = merge(tomap({
    "DD_SITE" : var.dd_site
    "DD_SERVICE" : var.service_name
    "DD_ENV" : var.env
    "DD_VERSION" : var.app_version
    "ENV" : var.env
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_CAPTURE_LAMBDA_PAYLOAD": "true"
    "AWS_LAMBDA_EXEC_WRAPPER": "/opt/datadog_wrapper"
    "DD_LOGS_INJECTION": "true"
    "POWERTOOLS_SERVICE_NAME": var.service_name
    "POWERTOOLS_LOG_LEVEL": "DEBUG"}),
    var.environment_variables
  )

  datadog_extension_layer_version = 64
  datadog_dotnet_layer_version      = 15
}