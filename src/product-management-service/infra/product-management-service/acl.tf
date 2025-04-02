//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "public_event_acl_dlq" {
  name = "Products-stock-updated-acl-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_event_acl_queue" {
  name                      = "Products-stock-updated-acl-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_event_acl_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic" "product_stock_level_updated" {
  name = "Products-stock-updated-${var.env}"
}

module "shared_bus_stock_updated_subscription" {
  source        = "../modules/shared_bus_to_domain"
  rule_name = "ProductManagement_StockUpdated_Rule"
  env           = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn = aws_cloudwatch_event_bus.product_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.product_service_bus.name
  queue_arn = aws_sqs_queue.public_event_acl_queue.arn
  queue_name = aws_sqs_queue.public_event_acl_queue.name
  queue_id = aws_sqs_queue.public_event_acl_queue.id
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockUpdated.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

module "product_acl_function" {
  service_name   = "ProductManagementService"
  source         = "../modules/lambda-function"
  entry_point = "../src/product-acl/inventory-stock-updated-event-handler"
  function_name  = "InventoryStockUpdatedACL"
  lambda_handler = "index.handler"
  environment_variables = {
    STOCK_LEVEL_UPDATED_TOPIC_ARN : aws_sns_topic.product_stock_level_updated.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.sns_publish_stock_updated.arn
  ]
}

resource "aws_lambda_event_source_mapping" "acl_event_source_mapping" {
  event_source_arn        = aws_sqs_queue.public_event_acl_queue.arn
  function_name           = module.product_acl_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_sqs_queue" "public_pricing_updated_dlq" {
  name = "ProductManagementService-pricing-updated-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_pricing_updated_queue" {
  name                      = "ProductManagementService-pricing-updated-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_pricing_updated_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic" "product_price_calculated" {
  name = "ProductManagementService-price-calculated-${var.env}"
}

module "shared_bus_pricing_updated_subscription" {
  source        = "../modules/shared_bus_to_domain"
  rule_name = "ProductManagement_PricingUpdated_Rule"
  env           = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn = aws_cloudwatch_event_bus.product_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.product_service_bus.name
  queue_arn = aws_sqs_queue.public_pricing_updated_queue.arn
  queue_name = aws_sqs_queue.public_pricing_updated_queue.name
  queue_id = aws_sqs_queue.public_pricing_updated_queue.id
  event_pattern  = <<EOF
{
  "detail-type": [
    "pricing.pricingCalculated.v1"
  ],
  "source": [
    "${var.env}.pricing"
  ]
}
EOF
}

module "product_pricing_updated_acl_function" {
  service_name   = "ProductManagementService"
  source         = "../modules/lambda-function"
  entry_point = "../src/product-acl/pricing-changed-handler"
  function_name  = "PricingChangedACL"
  lambda_handler = "index.handler"
  environment_variables = {
    PRICE_CALCULATED_TOPIC_ARN : aws_sns_topic.product_price_calculated.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.sns_publish_price_calculated.arn
  ]
}

resource "aws_lambda_event_source_mapping" "pricing_updated_event_source_mapping" {
  event_source_arn        = aws_sqs_queue.public_pricing_updated_queue.arn
  function_name           = module.product_pricing_updated_acl_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}


