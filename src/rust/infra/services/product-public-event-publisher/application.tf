//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "public_event_publisher_dlq" {
  name = "product-event-publisher-dlq"
}

resource "aws_sqs_queue" "public_event_publisher_queue" {
  name                      = "product-event-publisher-queue"
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
  service_name   = "RustProductPublicEventPublisher"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/publicEventPublisherFunction/publicEventPublisherFunction.zip"
  function_name  = "RustProductPublicEventPublisher"
  lambda_handler = "index.handler"
  environment_variables = {
    PRODUCT_CREATED_TOPIC_ARN : data.aws_ssm_parameter.product_created_topic_param.value
    PRODUCT_UPDATED_TOPIC_ARN : data.aws_ssm_parameter.product_updated_topic_param.value
    PRODUCT_DELETED_TOPIC_ARN : data.aws_ssm_parameter.product_deleted_topic_param.value
    DD_SERVICE_MAPPING : "lambda_sqs:${aws_sqs_queue.public_event_publisher_queue.name}"
    EVENT_BUS_NAME : data.aws_ssm_parameter.eb_name.value
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
}

resource "aws_lambda_event_source_mapping" "public_event_publisher" {
  event_source_arn = aws_sqs_queue.public_event_publisher_queue.arn
  function_name    = module.product_public_event_publisher.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "product_created_handler_publish_permission" {
  role       = module.product_public_event_publisher.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sqs_receive_permission" {
  role       = module.product_public_event_publisher.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_public_event_publisher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_created_topic_param.value
}

resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_created_topic_param.value
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
resource "aws_sns_topic_subscription" "product_updated_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_updated_topic_param.value
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
resource "aws_sns_topic_subscription" "product_deleted_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_deleted_topic_param.value
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.public_event_publisher_queue.arn
}
