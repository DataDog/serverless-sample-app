
//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "public_event_publisher_dlq" {
  name = "ProductManagementService-event-publisher-dlq-${var.env}"
}

resource "aws_sqs_queue" "public_event_publisher_queue" {
  name                      = "ProductManagementService-event-publisher-queue-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.public_event_publisher_dlq.arn
    maxReceiveCount     = 4
  })
}

resource "aws_sqs_queue_policy" "allow_sns_publish" {
  queue_url = aws_sqs_queue.public_event_publisher_queue.id
  policy    = data.aws_iam_policy_document.public_event_publisher_policy.json
}

module "product_public_event_publisher" {
  service_name   = "ProductManagementService"
  source         = "../modules/lambda-function"
  entry_point = "../src/product-event-publisher/public-event-publisher"
  function_name  = "EventPublisher"
  lambda_handler = "index.handler"
  environment_variables = {
    PRODUCT_CREATED_TOPIC_ARN : aws_sns_topic.product_created.arn
    PRODUCT_UPDATED_TOPIC_ARN : aws_sns_topic.product_updated.arn
    PRODUCT_DELETED_TOPIC_ARN : aws_sns_topic.product_deleted.arn
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.product_service_bus.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.event_publisher_sqs_receive_policy.arn
  ]
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn = aws_sqs_queue.public_event_publisher_queue.arn
  function_name    = module.product_public_event_publisher.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_public_event_publisher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.product_created.arn
}

resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = aws_sns_topic.product_created.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
resource "aws_sns_topic_subscription" "product_updated_sns_topic" {
  topic_arn = aws_sns_topic.product_updated.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
resource "aws_sns_topic_subscription" "product_deleted_sns_topic" {
  topic_arn = aws_sns_topic.product_deleted.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
