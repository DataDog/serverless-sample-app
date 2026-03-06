//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "search_api_endpoint" {
  description = "The Product Search Service API Gateway endpoint URL"
  value       = module.product_search_service.search_api_endpoint
}

output "metadata_table_name" {
  description = "The name of the Product Search metadata DynamoDB table"
  value       = module.product_search_service.metadata_table_name
}

output "catalog_sync_queue_url" {
  description = "The URL of the catalog sync SQS queue"
  value       = module.product_search_service.catalog_sync_queue_url
}
