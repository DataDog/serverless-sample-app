
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

resource "aws_sqs_queue_policy" "allow_eb_publish_stock_reserved" {
  queue_url = aws_sqs_queue.stock_reserved_queue.id
  policy    = data.aws_iam_policy_document.eb_queue_policy.json
}

module "handle_inventory_stock_reserved_function" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "HandleStockReserved"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleStockReserved_Generated::HandleStockReserved"
  environment_variables = {
    EVENT_BUS_NAME : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_lambda_event_source_mapping" "stock_reserved_queue" {
  event_source_arn        = aws_sqs_queue.stock_reserved_queue.arn
  function_name           = module.handle_inventory_stock_reserved_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "stock_reserved_handler_sqs_receive_permission" {
  role       = module.handle_inventory_stock_reserved_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "stock_reserved_handler_step_functions" {
  role       = module.handle_inventory_stock_reserved_function.function_role_name
  policy_arn = aws_iam_policy.step_functions_interactions.arn
}

resource "aws_iam_role_policy_attachment" "stock_reserved_handler_eb_publish" {
  role       = module.handle_inventory_stock_reserved_function.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_iam_role_policy_attachment" "stock_reserved_handler_dynamo_read" {
  role       = module.handle_inventory_stock_reserved_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "stock_reserved_handler_dynamo_write" {
  role       = module.handle_inventory_stock_reserved_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_cloudwatch_event_target" "stock_reserved_sqs_target" {
  rule           = aws_cloudwatch_event_rule.stock_reserved_rule.name
  target_id      = aws_sqs_queue.stock_reserved_queue.name
  arn            = aws_sqs_queue.stock_reserved_queue.arn
  event_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
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

resource "aws_sqs_queue_policy" "allow_eb_publish_stock_reservation_failed" {
  queue_url = aws_sqs_queue.stock_reservation_failed_queue.id
  policy    = data.aws_iam_policy_document.eb_queue_policy.json
}

module "handle_inventory_stock_reservation_failed_function" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "HandleStockReservationFailed"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleReservationFailed_Generated::HandleReservationFailed"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name.value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_lambda_event_source_mapping" "stock_reservation_failed_queue" {
  event_source_arn        = aws_sqs_queue.stock_reservation_failed_queue.arn
  function_name           = module.handle_inventory_stock_reservation_failed_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "stock_reservation_failed_handler_sqs_receive_permission" {
  role       = module.handle_inventory_stock_reservation_failed_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "stock_reservation_failed_handler_step_functions" {
  role       = module.handle_inventory_stock_reservation_failed_function.function_role_name
  policy_arn = aws_iam_policy.step_functions_interactions.arn
}

resource "aws_iam_role_policy_attachment" "stock_reservation_failed_handler_eb_publish" {
  role       = module.handle_inventory_stock_reservation_failed_function.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_iam_role_policy_attachment" "stock_reservation_failed_handler_dynamo_read" {
  role       = module.handle_inventory_stock_reservation_failed_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "stock_reservation_failed_handler_dynamo_write" {
  role       = module.handle_inventory_stock_reservation_failed_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_cloudwatch_event_target" "stock_reservation_failed_sqs_target" {
  rule           = aws_cloudwatch_event_rule.stock_reservation_failed_rule.name
  target_id      = aws_sqs_queue.stock_reservation_failed_queue.name
  arn            = aws_sqs_queue.stock_reservation_failed_queue.arn
  event_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
}

module "confirm_order_handler" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "ConfirmOrders"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationSuccess_Generated::ReservationSuccess"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name.value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "confirm_order_handler_step_functions" {
  role       = module.confirm_order_handler.function_role_name
  policy_arn = aws_iam_policy.step_functions_interactions.arn
}

resource "aws_iam_role_policy_attachment" "confirm_order_handler_eb_publish" {
  role       = module.confirm_order_handler.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_iam_role_policy_attachment" "confirm_order_handler_dynamo_read" {
  role       = module.confirm_order_handler.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "confirm_order_handler_dynamo_write" {
  role       = module.confirm_order_handler.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

module "no_stock_handler" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "NoStock"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationFailed_Generated::ReservationFailed"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name.value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "no_stock_handler_step_functions" {
  role       = module.no_stock_handler.function_role_name
  policy_arn = aws_iam_policy.step_functions_interactions.arn
}

resource "aws_iam_role_policy_attachment" "no_stock_handler_eb_publish" {
  role       = module.no_stock_handler.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_iam_role_policy_attachment" "no_stock_handler_dynamo_read" {
  role       = module.no_stock_handler.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "no_stock_handler_dynamo_write" {
  role       = module.no_stock_handler.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}
