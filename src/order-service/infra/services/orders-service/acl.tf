
//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "stock_reserved_dlq" {
  name = "OrdersService-StockReservedDLQ-${var.env}"
}

resource "aws_sqs_queue" "stock_reserved_queue" {
  name                      = "Orders-StockReserved-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.stock_reserved_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_stock_reserved_subscription" {
  source        = "../../modules/shared_bus_to_domain"
  rule_name = "Orders_StockReserved_Rule"
  env           = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  queue_arn = aws_sqs_queue.stock_reserved_queue.arn
  queue_name = aws_sqs_queue.stock_reserved_queue.name
  queue_id = aws_sqs_queue.stock_reserved_queue.id
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockReserved.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

module "handle_inventory_stock_reserved_function" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "HandleStockReserved"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleStockReserved_Generated::HandleStockReserved"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.step_functions_interactions.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn
  ]
}

resource "aws_lambda_event_source_mapping" "stock_reserved_queue" {
  event_source_arn        = aws_sqs_queue.stock_reserved_queue.arn
  function_name           = module.handle_inventory_stock_reserved_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_sqs_queue" "stock_reservation_failed_dlq" {
  name = "OrdersService-StockReservedFailedDLQ-${var.env}"
}

resource "aws_sqs_queue" "stock_reservation_failed_queue" {
  name                      = "OrdersService-StockReservationFailed-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.stock_reservation_failed_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_stock_reservation_failed_subscription" {
  source        = "../../modules/shared_bus_to_domain"
  rule_name = "Orders_StockReservationFailed_Rule"
  env           = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  queue_arn = aws_sqs_queue.stock_reservation_failed_queue.arn
  queue_name = aws_sqs_queue.stock_reservation_failed_queue.name
  queue_id = aws_sqs_queue.stock_reservation_failed_queue.id
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockReservationFailed.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

module "handle_inventory_stock_reservation_failed_function" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "HandleStockReservationFailed"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleReservationFailed_Generated::HandleReservationFailed"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.step_functions_interactions.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn
  ]
}

resource "aws_lambda_event_source_mapping" "stock_reservation_failed_queue" {
  event_source_arn        = aws_sqs_queue.stock_reservation_failed_queue.arn
  function_name           = module.handle_inventory_stock_reservation_failed_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}
