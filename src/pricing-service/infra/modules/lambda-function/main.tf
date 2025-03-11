//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_iam_role" "lambda_function_role" {
  name = "tf-node-${var.function_name}-lambda-role-${var.env}"
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

// The Datadog extension sends log data to Datadog using the telemetry API, disabling CloudWatch prevents 'double paying' for logs
resource "aws_iam_policy" "function_logging_policy" {
  name = "TF-${var.service_name}-${var.function_name}-${var.env}-logging-policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "logs:CreateLogStream",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect : "Deny",
        Resource : "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_policy" "dd_api_secret_policy" {
  name = "tf-node-${var.function_name}-api-key-secret-policy-${var.env}"
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

resource "aws_iam_role_policy_attachment" "additional_policy_attachments" {
  count      = length(var.additional_policy_attachments)
  role       = aws_iam_role.lambda_function_role.id
  policy_arn = var.additional_policy_attachments[count.index]
}

resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/tf-node-${var.function_name}-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}

resource "aws_lambda_function" "function" {
  # If the file is not in the current working directory you will need to include a
  # path.module in the filename.
  filename      = var.zip_file
  function_name = "PricingService-${var.function_name}-${var.env}"
  role          = aws_iam_role.lambda_function_role.arn
  handler       = var.lambda_handler
  runtime       = "nodejs22.x"
  memory_size   = var.memory_size
  logging_config {
    log_group  = aws_cloudwatch_log_group.lambda_log_group.name
    log_format = "JSON"
  }
  source_code_hash = filebase64sha256(var.zip_file)
  timeout          = var.function_timeout

  environment {
    variables = merge({
      "TEAM"                    = "pricing"
      "DOMAIN"                  = "pricing"
      "DEPLOYED_AT"             = timestamp()
      "ENV"                     = var.env
      "POWERTOOLS_SERVICE_NAME" = var.service_name
      "POWERTOOLS_LOG_LEVEL"    = "INFO"
    }, var.environment_variables)
  }
}
