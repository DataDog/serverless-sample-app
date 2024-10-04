//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "public_event_acl_dlq" {
  name = "tf-dotnet-inventory-acl-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_event_acl_queue" {
  name                      = "tf-dotnet-inventory-acl-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_event_acl_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sns_topic" "dotnet_inventory_new_product_added" {
  name = "tf-dotnet-inventory-new-product-added-${var.env}"
}

resource "aws_sqs_queue_policy" "allow_eb_publish" {
  queue_url = aws_sqs_queue.public_event_acl_queue.id
  policy    = data.aws_iam_policy_document.inventory_acl_queue_policy.json
}

module "inventory_acl_function" {
  publish_directory = "../src/Inventory.Acl/Inventory.Acl.Adapters/bin/Release/net8.0/Inventory.Acl.Adapters.zip"
  service_name   = "InventoryAcl"
  source         = "../../modules/lambda-function"
  function_name  = "DotnetInventoryAcl"
  lambda_handler = "Inventory.Acl.Adapters::Inventory.Acl.Adapters.HandlerFunctions_HandleCreated_Generated::HandleCreated"
  environment_variables = {
    PRODUCT_ADDED_TOPIC_ARN : aws_sns_topic.dotnet_inventory_new_product_added.arn
    DD_SERVICE_MAPPING : "lambda_sqs:${aws_sqs_queue.public_event_acl_queue.name}"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn        = aws_sqs_queue.public_event_acl_queue.arn
  function_name           = module.inventory_acl_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sqs_receive_permission" {
  role       = module.inventory_acl_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sns_publish" {
  role       = module.inventory_acl_function.function_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

resource "aws_cloudwatch_event_rule" "event_rule" {
  name           = "InventoryAclRule"
  event_bus_name = data.aws_ssm_parameter.eb_name.value
  event_pattern  = <<EOF
{
  "detail-type": [
    "product.productCreated.v1"
  ],
  "source": [
    "${var.env}.products"
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
