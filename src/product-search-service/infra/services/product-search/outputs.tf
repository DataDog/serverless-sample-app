//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "search_api_endpoint" {
  description = "The Product Search Service API Gateway endpoint URL"
  value       = aws_apigatewayv2_stage.search_api_stage.invoke_url
}

output "metadata_table_name" {
  description = "The name of the Product Search metadata DynamoDB table"
  value       = aws_dynamodb_table.product_search_metadata_table.name
}

output "metadata_table_arn" {
  description = "The ARN of the Product Search metadata DynamoDB table"
  value       = aws_dynamodb_table.product_search_metadata_table.arn
}

output "catalog_sync_queue_url" {
  description = "The URL of the catalog sync SQS queue"
  value       = aws_sqs_queue.catalog_sync_queue.url
}

output "catalog_sync_queue_arn" {
  description = "The ARN of the catalog sync SQS queue"
  value       = aws_sqs_queue.catalog_sync_queue.arn
}

output "catalog_sync_function_arn" {
  description = "The ARN of the CatalogSync Lambda function"
  value       = module.catalog_sync_lambda.function_arn
}

output "product_search_function_arn" {
  description = "The ARN of the ProductSearch Lambda function"
  value       = module.product_search_lambda.function_arn
}
