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
  name              = "/aws/lambda/TfJava-${var.function_name}-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}


module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "2.0.0"

  filename                 = var.jar_file
  function_name            = "TfJava-${var.function_name}-${var.env}"
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = "org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest"
  runtime                  = "java21"
  memory_size              = var.memory_size
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash         = base64sha256(filebase64(var.jar_file))
  timeout                  = var.timeout
  publish                  = var.enable_snap_start
  snap_start_apply_on      = var.enable_snap_start ? "PublishedVersions" : "None"

  environment_variables = merge(tomap({
    "MAIN_CLASS" : "${var.package_name}.FunctionConfiguration"
    "DD_SITE" : var.dd_site
    "DD_SERVICE" : var.service_name
    "DD_ENV" : var.env
    "ENV" : var.env
    "DD_VERSION" : var.app_version
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_CAPTURE_LAMBDA_PAYLOAD" : "true"
    "DD_SERVERLESS_APPSEC_ENABLED": "true"
    "DD_IAST_ENABLED": "true"
    "DD_LOGS_INJECTION" : "true"
    "spring_cloud_function_definition" : var.lambda_handler }),
    var.environment_variables
  )

  datadog_extension_layer_version = 66
  datadog_java_layer_version      = 15
}

resource "aws_lambda_alias" "SnapStartAlias" {
  count            = var.enable_snap_start ? 1 : 0
  name             = var.env
  description      = "Alias for SnapStart"
  function_name    = module.aws_lambda_function.function_name
  function_version = module.aws_lambda_function.version
}