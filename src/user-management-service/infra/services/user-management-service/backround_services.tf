//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "order_completed_dlq" {
  name = "UserManagement-OrderCompletedDLQ-${var.env}"
}

resource "aws_sqs_queue" "order_completed_queue" {
  name                      = "UserManagement-OrderCompletedQueue-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_completed_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "allow_eb_publish" {
  queue_url = aws_sqs_queue.order_completed_queue.id
  policy    = data.aws_iam_policy_document.order_completed_queue_policy.json
}

module "shared_bus_order_completed_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "UserManagement_OrderCompleted_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.user_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.user_service_bus.name
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

module "order_completed_handler" {
  service_name   = "UserManagement"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/handleOrderCompletedFunction/handleOrderCompletedFunction.zip"
  function_name  = "HandleOrderCompletedEvent"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn
  ]
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn        = aws_sqs_queue.order_completed_queue.arn
  function_name           = module.order_completed_handler.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}