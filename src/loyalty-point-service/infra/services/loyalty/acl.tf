
//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "user_created_dlq" {
  name = "LoyaltyService-UserCreatedDLQ-${var.env}"
}

resource "aws_sqs_queue" "user_created_queue" {
  name                      = "LoyaltyService-UserCreated-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.user_created_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_stock_reserved_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "LoyaltyService_UserCreated_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.loyalty_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.loyalty_service_bus.name
  queue_arn       = aws_sqs_queue.user_created_queue.arn
  queue_name      = aws_sqs_queue.user_created_queue.name
  queue_id        = aws_sqs_queue.user_created_queue.id
  event_pattern   = <<EOF
{
  "detail-type": [
    "users.userCreated.v1"
  ],
  "source": [
    "${var.env}.users"
  ]
}
EOF
}

module "handle_user_created_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/handleUserCreatedFunction/handleUserCreatedFunction.zip"
  function_name  = "HandleUserCreated"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.loyalty_table.name
    "DD_TRACE_DYNAMODB_TABLE_PRIMARY_KEYS": "{\"${aws_dynamodb_table.loyalty_table.id}\": [\"PK\"]}"
    "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "none"
    "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "false"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.eb_publish.arn
  ]
}

resource "aws_lambda_event_source_mapping" "user_created_queue_esm" {
  event_source_arn        = aws_sqs_queue.user_created_queue.arn
  function_name           = module.handle_user_created_lambda.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_sqs_queue" "order_completed_dlq" {
  name = "LoyaltyService-OrderCompletedDLQ-${var.env}"
}

resource "aws_sqs_queue" "order_completed_queue" {
  name                      = "LoyaltyService-OrderCompletedQueue-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_completed_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_order_completed_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "LoyaltyService_OrderCompleted_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.loyalty_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.loyalty_service_bus.name
  queue_arn       = aws_sqs_queue.order_completed_queue.arn
  queue_name      = aws_sqs_queue.order_completed_queue.name
  queue_id        = aws_sqs_queue.order_completed_queue.id
  event_pattern   = <<EOF
{
  "detail-type": [
    "orders.orderCompleted.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

module "shared_bus_order_completed_v2_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "LoyaltyService_OrderCompleted_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.loyalty_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.loyalty_service_bus.name
  queue_arn       = aws_sqs_queue.order_completed_queue.arn
  queue_name      = aws_sqs_queue.order_completed_queue.name
  queue_id        = aws_sqs_queue.order_completed_queue.id
  event_pattern   = <<EOF
{
  "detail-type": [
    "orders.orderCompleted.v2"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

module "handle_order_completed_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/handleOrderCompletedFunction/handleOrderCompletedFunction.zip"
  function_name  = "HandleOrderCompleted"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.loyalty_table.name
    "DD_TRACE_DYNAMODB_TABLE_PRIMARY_KEYS": "{\"${aws_dynamodb_table.loyalty_table.id}\": [\"PK\"]}"
    "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "none"
    "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "false"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.eb_publish.arn
  ]
}

resource "aws_lambda_event_source_mapping" "stock_reservation_failed_queue" {
  event_source_arn        = aws_sqs_queue.order_completed_queue.arn
  function_name           = module.handle_order_completed_lambda.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}
