//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "product_created_public_event_publisher" {
  publish_directory = "../src/Product.EventPublisher/ProductEventPublisher.Adapters/bin/Release/net8.0/ProductEventPublisher.Adapters.zip"
  service_name   = "DotnetProductCreatedPublicEventPublisher"
  source         = "../../modules/lambda-function"
  function_name  = "DotnetProductCreatedPublicEventPublisher"
  lambda_handler = "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleCreated_Generated::HandleCreated"
  environment_variables = {
    EVENT_BUS_NAME : data.aws_ssm_parameter.eb_name.value
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
}

resource "aws_iam_role_policy_attachment" "product_created_handler_publish_permission" {
  role       = module.product_created_public_event_publisher.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_created_public_event_publisher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_created_topic_param.value
}

resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_created_topic_param.value
  protocol  = "lambda"
  endpoint  = module.product_created_public_event_publisher.function_arn
}

module "product_updated_public_event_publisher" {
  publish_directory = "../src/Product.EventPublisher/ProductEventPublisher.Adapters/bin/Release/net8.0/ProductEventPublisher.Adapters.zip"
  service_name   = "DotnetProductUpdatedPublicEventPublisher"
  source         = "../../modules/lambda-function"
  function_name  = "DotnetProductUpdatedPublicEventPublisher"
  lambda_handler = "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleUpdated_Generated::HandleUpdated"
  environment_variables = {
    EVENT_BUS_NAME : data.aws_ssm_parameter.eb_name.value
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
}

resource "aws_iam_role_policy_attachment" "product_updated_handler_publish_permission" {
  role       = module.product_updated_public_event_publisher.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_lambda_permission" "product_updated_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_updated_public_event_publisher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_updated_topic_param.value
}

resource "aws_sns_topic_subscription" "product_updated_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_updated_topic_param.value
  protocol  = "lambda"
  endpoint  = module.product_updated_public_event_publisher.function_arn
}

module "product_deleted_public_event_publisher" {
  publish_directory = "../src/Product.EventPublisher/ProductEventPublisher.Adapters/bin/Release/net8.0/ProductEventPublisher.Adapters.zip"
  service_name   = "DotnetProductDeletedPublicEventPublisher"
  source         = "../../modules/lambda-function"
  function_name  = "DotnetProductDeletedPublicEventPublisher"
  lambda_handler = "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleDeleted_Generated::HandleDeleted"
  environment_variables = {
    EVENT_BUS_NAME : data.aws_ssm_parameter.eb_name.value
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
}

resource "aws_iam_role_policy_attachment" "product_deleted_handler_publish_permission" {
  role       = module.product_deleted_public_event_publisher.function_role_name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_lambda_permission" "product_deleted_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_deleted_public_event_publisher.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_deleted_topic_param.value
}

resource "aws_sns_topic_subscription" "product_deleted_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_deleted_topic_param.value
  protocol  = "lambda"
  endpoint  = module.product_deleted_public_event_publisher.function_arn
}
