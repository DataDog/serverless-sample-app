//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_endpoint" {
  description = "The API Gateway endpoint URL"
  value       = aws_api_gateway_stage.rest_api_stage.invoke_url
}

output "activities_table_name" {
  description = "The name of the Activities DynamoDB table"
  value       = aws_dynamodb_table.activities_table.name
}

output "activities_table_arn" {
  description = "The ARN of the Activities DynamoDB table"
  value       = aws_dynamodb_table.activities_table.arn
}

output "idempotency_table_name" {
  description = "The name of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.idempotency_table.name
}

output "idempotency_table_arn" {
  description = "The ARN of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.idempotency_table.arn
}

output "event_bus_name" {
  description = "The name of the Activity Service EventBridge bus"
  value       = aws_cloudwatch_event_bus.activity_service_bus.name
}

output "event_bus_arn" {
  description = "The ARN of the Activity Service EventBridge bus"
  value       = aws_cloudwatch_event_bus.activity_service_bus.arn
}

output "activity_queue_url" {
  description = "The URL of the Activity SQS queue"
  value       = aws_sqs_queue.activity_queue.url
}

output "activity_queue_arn" {
  description = "The ARN of the Activity SQS queue"
  value       = aws_sqs_queue.activity_queue.arn
}

output "get_activity_function_arn" {
  description = "The ARN of the Get Activity Lambda function"
  value       = module.get_activity_lambda.function_arn
}

output "handle_events_function_arn" {
  description = "The ARN of the Handle Events Lambda function"
  value       = module.handle_events_lambda.function_arn
}

output "common_layer_arn" {
  description = "The ARN of the common Lambda layer"
  value       = module.get_activity_lambda.common_layer_arn
}