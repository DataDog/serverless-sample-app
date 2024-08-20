//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sqs_queue" "analytics_service_dlq" {
  name = "analytics-service-dlq"
}

resource "aws_sqs_queue" "analytics_service_queue" {
  name                      = "analytics-service-queue"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analytics_service_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "allow_eb_publish" {
  queue_url = aws_sqs_queue.analytics_service_queue.id
  policy    = data.aws_iam_policy_document.analytics_service_queue_policy.json
}

module "analytics_service_function" {
  service_name   = "JavaAnalyticsBackend"
  source         = "../../modules/lambda-function"
  jar_file       = "../analytics-backend/target/com.analytics-0.0.1-SNAPSHOT-aws.jar"
  function_name  = "JavaAnalyticsBackend"
  lambda_handler = "handleEvents"
  package_name = "com.analytics"
  environment_variables = {
    DD_TRACE_PROPAGATION_STYLE: "none"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
}

resource "aws_lambda_event_source_mapping" "analytics_backend_source" {
  event_source_arn        = aws_sqs_queue.analytics_service_queue.arn
  function_name           = module.analytics_service_function.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sqs_receive_permission" {
  role       = module.analytics_service_function.function_role_name
  policy_arn = aws_iam_policy.sqs_receive_policy.arn
}

resource "aws_cloudwatch_event_rule" "event_rule" {
  name           = "AnalyticsBackendRule"
  event_bus_name = data.aws_ssm_parameter.eb_name.value
  event_pattern  = <<EOF
{
  "source": [{
    "prefix": "${var.env}."
  }]
}
EOF
}

resource "aws_cloudwatch_event_target" "sqs_target" {
  rule           = aws_cloudwatch_event_rule.event_rule.name
  target_id      = aws_sqs_queue.analytics_service_queue.name
  arn            = aws_sqs_queue.analytics_service_queue.arn
  event_bus_name = data.aws_ssm_parameter.eb_name.value
}
