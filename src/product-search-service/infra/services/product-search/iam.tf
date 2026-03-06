//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# CatalogSync Lambda policies
# ---------------------------------------------------------------------------

# DynamoDB write/read access for the catalog sync function
resource "aws_iam_policy" "catalog_sync_dynamodb_policy" {
  name        = "TF-ProductSearchService-catalog-sync-dynamodb-${var.env}"
  description = "Policy to allow CatalogSync Lambda to read/write the metadata table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.product_search_metadata_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# Bedrock InvokeModel for Titan embedding model (CatalogSync)
resource "aws_iam_policy" "catalog_sync_bedrock_policy" {
  name        = "TF-ProductSearchService-catalog-sync-bedrock-${var.env}"
  description = "Policy to allow CatalogSync Lambda to invoke the Titan embedding model"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "arn:aws:bedrock:${var.region}::foundation-model/amazon.titan-embed-text-v2:0"
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# SSM GetParameter for product management API endpoint
resource "aws_iam_policy" "catalog_sync_ssm_policy" {
  name        = "TF-ProductSearchService-catalog-sync-ssm-${var.env}"
  description = "Policy to allow CatalogSync Lambda to read the product management API endpoint from SSM"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/ProductManagementService/api-endpoint"
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# S3 Vectors access for CatalogSync (ARN format TBD until S3 Vectors exits preview)
resource "aws_iam_policy" "catalog_sync_s3_vectors_policy" {
  name        = "TF-ProductSearchService-catalog-sync-s3-vectors-${var.env}"
  description = "Policy to allow CatalogSync Lambda to read/write S3 Vectors (ARN format TBD until S3 Vectors exits preview)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3vectors:PutObject",
          "s3vectors:GetObject",
          "s3vectors:DeleteObject",
          "s3vectors:ListObjects"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# SQS receive/delete for the catalog sync queue
resource "aws_iam_policy" "catalog_sync_sqs_policy" {
  name        = "TF-ProductSearchService-catalog-sync-sqs-${var.env}"
  description = "Policy to allow CatalogSync Lambda to consume messages from the catalog sync SQS queue"

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
          aws_sqs_queue.catalog_sync_queue.arn,
          aws_sqs_queue.catalog_sync_dlq.arn
        ]
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# ---------------------------------------------------------------------------
# ProductSearch Lambda policies
# ---------------------------------------------------------------------------

# DynamoDB BatchGetItem for the metadata table (ProductSearch)
resource "aws_iam_policy" "product_search_dynamodb_policy" {
  name        = "TF-ProductSearchService-product-search-dynamodb-${var.env}"
  description = "Policy to allow ProductSearch Lambda to batch-read the metadata table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:BatchGetItem"
        ]
        Resource = aws_dynamodb_table.product_search_metadata_table.arn
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# Bedrock InvokeModel for Titan embedding + Claude Haiku generation (ProductSearch)
resource "aws_iam_policy" "product_search_bedrock_policy" {
  name        = "TF-ProductSearchService-product-search-bedrock-${var.env}"
  description = "Policy to allow ProductSearch Lambda to invoke Titan and Haiku Bedrock models"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = [
          "arn:aws:bedrock:${var.region}::foundation-model/amazon.titan-embed-text-v2:0",
          "arn:aws:bedrock:${var.region}::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0"
        ]
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# S3 Vectors query/read access for ProductSearch (ARN format TBD until S3 Vectors exits preview)
resource "aws_iam_policy" "product_search_s3_vectors_policy" {
  name        = "TF-ProductSearchService-product-search-s3-vectors-${var.env}"
  description = "Policy to allow ProductSearch Lambda to query S3 Vectors (ARN format TBD until S3 Vectors exits preview)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3vectors:QueryObjects",
          "s3vectors:GetObject",
          "s3vectors:ListObjects"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}
