//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_endpoint" {
  description = "The Activity Service API Gateway endpoint URL"
  value       = module.activity.api_endpoint
}

output "activities_table_name" {
  description = "The name of the Activities DynamoDB table"
  value       = module.activity.activities_table_name
}

output "event_bus_name" {
  description = "The name of the Activity Service EventBridge bus"
  value       = module.activity.event_bus_name
}

output "activity_queue_url" {
  description = "The URL of the Activity SQS queue"
  value       = module.activity.activity_queue_url
}