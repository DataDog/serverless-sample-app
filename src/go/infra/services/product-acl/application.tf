//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "public_event_acl_dlq" {
  name = "TfGo-product-acl-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_event_acl_queue" {
  name                      = "TfGo-product-acl-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_event_acl_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic" "go_product_stock_level_updated" {
  name = "TfGo-go-product-stock-updated-${var.env}"
}

resource "aws_sqs_queue_policy" "allow_eb_publish" {
  queue_url = aws_sqs_queue.public_event_acl_queue.id
  policy    = data.aws_iam_policy_document.product_acl_queue_policy.json
}

module "product_acl_function" {
  service_name   = "GoProductAcl"
  source         = "../../modules/lambda-function"
  entry_point = "../src/product-acl/inventory-stock-updated-event-handler"
  function_name  = "GoProductAcl"
  lambda_handler = "index.handler"
  environment_variables = {
    STOCK_LEVEL_UPDATED_TOPIC_ARN : aws_sns_topic.go_product_stock_level_updated.arn
    DD_SERVICE_MAPPING : "lambda_sqs:${aws_sqs_queue.public_event_acl_queue.name}"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn        = aws_sqs_queue.public_event_acl_queue.arn
  function_name           = module.product_acl_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sqs_receive_permission" {
  role       = module.product_acl_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sns_publish" {
  role       = module.product_acl_function.function_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

resource "aws_cloudwatch_event_rule" "event_rule" {
  name           = "ProductAclRule-StockUpdated"
  event_bus_name = data.aws_ssm_parameter.eb_name.value
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

resource "aws_cloudwatch_event_target" "sqs_target" {
  rule           = aws_cloudwatch_event_rule.event_rule.name
  target_id      = aws_sqs_queue.public_event_acl_queue.name
  arn            = aws_sqs_queue.public_event_acl_queue.arn
  event_bus_name = data.aws_ssm_parameter.eb_name.value
}
