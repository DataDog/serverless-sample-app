//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "random_id" "random_string" {
  byte_length = 8
}

resource "aws_s3_bucket" "lambda_code_storage_bucket" {
  bucket = "inventory-service-${var.env}-lambda-code-${random_id.random_string.hex}"

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}

resource "aws_sqs_queue" "public_event_acl_dlq" {
  name = "InventoryOrdering-acl-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_event_acl_queue" {
  name                      = "InventoryOrdering-acl-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_event_acl_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic" "java_inventory_new_product_added" {
  name = "InventoryOrdering-new-product-added-${var.env}"
}

resource "aws_sqs_queue_policy" "allow_eb_publish" {
  queue_url = aws_sqs_queue.public_event_acl_queue.id
  policy    = data.aws_iam_policy_document.inventory_acl_queue_policy.json
}

module "inventory_acl_function" {
  service_name   = "InventoryOrdering"
  package_name = "com.inventory.acl"
  source         = "../../modules/lambda-function"
  jar_file       = "../inventory-acl/target/function.zip"
  function_name  = "InventoryProductCreated"
  lambda_handler = "io.quarkus.amazon.lambda.runtime.QuarkusStreamHandler::handleRequest"
  routing_expression = "handleProductCreated"
  environment_variables = {
    PRODUCT_ADDED_TOPIC_ARN : aws_sns_topic.java_inventory_new_product_added.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  env = var.env
  app_version = var.app_version
  s3_bucket_name = aws_s3_bucket.lambda_code_storage_bucket.id
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn        = aws_sqs_queue.public_event_acl_queue.arn
  function_name           = module.inventory_acl_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "inventory_acl_sqs_receive_policy" {
  role       = module.inventory_acl_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "inventory_acl_sns_publish" {
  role       = module.inventory_acl_function.function_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

resource "aws_cloudwatch_event_target" "sqs_target" {
  rule           = aws_cloudwatch_event_rule.product_created_event_rule.name
  target_id      = aws_sqs_queue.public_event_acl_queue.name
  arn            = aws_sqs_queue.public_event_acl_queue.arn
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
}

resource "aws_sqs_queue" "order_created_event_dlq" {
  name = "InventoryOrdering-order-created-dlq-${var.env}"
}

resource "aws_sqs_queue" "order_created_queue" {
  name                      = "InventoryOrdering-order-created-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_created_event_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "allow_order_created_eb_publish" {
  queue_url = aws_sqs_queue.order_created_queue.id
  policy    = data.aws_iam_policy_document.inventory_product_created_queue_policy.json
}

module "order_created_function" {
  service_name   = "InventoryOrdering"
  package_name = "com.inventory.acl"
  source         = "../../modules/lambda-function"
  jar_file       = "../inventory-acl/target/function.zip"
  function_name  = "InventoryOrderCreated"
  lambda_handler = "io.quarkus.amazon.lambda.runtime.QuarkusStreamHandler::handleRequest"
  routing_expression = "handleOrderCreated"
  environment_variables = {
    TABLE_NAME : aws_dynamodb_table.inventory_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  env = var.env
  app_version = var.app_version
  s3_bucket_name = aws_s3_bucket.lambda_code_storage_bucket.id
}

resource "aws_lambda_event_source_mapping" "order_created_esm" {
  event_source_arn        = aws_sqs_queue.order_created_queue.arn
  function_name           = module.order_created_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "inventory_order_created_sqs_receive_policy" {
  role       = module.order_created_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "order_created_function_acl_read" {
  role       = module.order_created_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "order_created_function_acl_write" {
  role       = module.order_created_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_cloudwatch_event_target" "order_created_sqs_target" {
  rule           = aws_cloudwatch_event_rule.order_created_event_rule.name
  target_id      = aws_sqs_queue.order_created_queue.name
  arn            = aws_sqs_queue.order_created_queue.arn
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
}

resource "aws_sqs_queue" "order_completed_event_dlq" {
  name = "InventoryOrdering-order-completed-dlq-${var.env}"
}

resource "aws_sqs_queue" "order_completed_queue" {
  name                      = "InventoryOrdering-order-completed-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_completed_event_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "allow_order_completed_eb_publish" {
  queue_url = aws_sqs_queue.order_completed_queue.id
  policy    = data.aws_iam_policy_document.inventory_order_completed_queue_policy.json
}

module "order_completed_function" {
  service_name   = "InventoryOrdering"
  package_name = "com.inventory.acl"
  source         = "../../modules/lambda-function"
  jar_file       = "../inventory-acl/target/function.zip"
  function_name  = "InventoryOrderCompleted"
  lambda_handler = "io.quarkus.amazon.lambda.runtime.QuarkusStreamHandler::handleRequest"
  routing_expression = "handleOrderCompleted"
  environment_variables = {
    TABLE_NAME : aws_dynamodb_table.inventory_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  env = var.env
  app_version = var.app_version
  s3_bucket_name = aws_s3_bucket.lambda_code_storage_bucket.id
}

resource "aws_lambda_event_source_mapping" "order_completed_esm" {
  event_source_arn        = aws_sqs_queue.order_completed_queue.arn
  function_name           = module.order_completed_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "inventory_order_completed_sqs_receive_policy" {
  role       = module.order_completed_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "order_completed_function_acl_read" {
  role       = module.order_completed_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "order_completed_function_acl_write" {
  role       = module.order_completed_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_cloudwatch_event_target" "order_completed_sqs_target" {
  rule           = aws_cloudwatch_event_rule.order_completed_event_rule.name
  target_id      = aws_sqs_queue.order_completed_queue.name
  arn            = aws_sqs_queue.order_completed_queue.arn
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
}
