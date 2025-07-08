//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# DynamoDB read policy for Activities table
resource "aws_iam_policy" "activities_table_read" {
  name        = "TF-ActivityService-activities-read-${var.env}"
  description = "Policy to allow reading from Activities DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.activities_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# DynamoDB write policy for Activities table
resource "aws_iam_policy" "activities_table_write" {
  name        = "TF-ActivityService-activities-write-${var.env}"
  description = "Policy to allow writing to Activities DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.activities_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# DynamoDB read policy for Idempotency table
resource "aws_iam_policy" "idempotency_table_read" {
  name        = "TF-ActivityService-idempotency-read-${var.env}"
  description = "Policy to allow reading from Idempotency DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.idempotency_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# DynamoDB write policy for Idempotency table
resource "aws_iam_policy" "idempotency_table_write" {
  name        = "TF-ActivityService-idempotency-write-${var.env}"
  description = "Policy to allow writing to Idempotency DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.idempotency_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# AppConfig access policy
resource "aws_iam_policy" "appconfig_access" {
  name        = "TF-ActivityService-appconfig-access-${var.env}"
  description = "Policy to allow access to AWS AppConfig"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "appconfig:GetLatestConfiguration",
          "appconfig:StartConfigurationSession"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# SSM parameter access policy for JWT secret
resource "aws_iam_policy" "get_jwt_ssm_parameter" {
  name        = "TF-ActivityService-get-jwt-ssm-parameter-${var.env}"
  description = "Policy to allow reading JWT secret from SSM Parameter Store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:*:parameter/${var.env}/shared/secret-access-key" : aws_ssm_parameter.activity_service_access_key[0].arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# SQS receive and delete message policy
resource "aws_iam_policy" "sqs_receive_delete" {
  name        = "TF-ActivityService-sqs-receive-delete-${var.env}"
  description = "Policy to allow receiving and deleting messages from SQS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.activity_queue.arn,
          aws_sqs_queue.activity_dead_letter_queue.arn
        ]
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# EventBridge publish policy
resource "aws_iam_policy" "eventbridge_publish" {
  name        = "TF-ActivityService-eventbridge-publish-${var.env}"
  description = "Policy to allow publishing events to EventBridge"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.activity_service_bus.arn,
          var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_arn[0].value : aws_cloudwatch_event_bus.activity_service_bus.arn
        ]
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}