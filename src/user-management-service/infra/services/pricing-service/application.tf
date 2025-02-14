//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sns_topic" "product_price_calculated" {
  name = "tf-rust-rust-price-calculated-topic-${var.env}"
}

module "product_pricing_created_handler" {
  service_name   = "RustProductPricingService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/productCreatedPricingHandler/productCreatedPricingHandler.zip"
  function_name  = "ProductCreatedPricingHandler"
  lambda_handler = "index.handler"
  environment_variables = {
    PRICE_CALCULATED_TOPIC_ARN: aws_sns_topic.product_price_calculated.arn
    DD_SERVICE_MAPPING: "lambda_sns:${aws_sns_topic.product_price_calculated.name}"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "product_created_handler_publish_permission" {
  role       = module.product_pricing_created_handler.function_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_pricing_created_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_created_topic_param.value
}


resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_created_topic_param.value
  protocol  = "lambda"
  endpoint  = module.product_pricing_created_handler.function_arn
}

module "product_pricing_updated_handler" {
  service_name   = "RustProductPricingService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/productUpdatedPricingHandler/productUpdatedPricingHandler.zip"
  function_name  = "ProductUpdatedPricingHandler"
  lambda_handler = "index.handler"
  environment_variables = {
    PRICE_CALCULATED_TOPIC_ARN: aws_sns_topic.product_price_calculated.arn
    DD_SERVICE_MAPPING: "lambda_sns:${aws_sns_topic.product_price_calculated.name}"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "product_updated_handler_publish_permission" {
  role       = module.product_pricing_updated_handler.function_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

resource "aws_lambda_permission" "product_updated_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_pricing_updated_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_updated_topic_param.value
}


resource "aws_sns_topic_subscription" "product_updated_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_updated_topic_param.value
  protocol  = "lambda"
  endpoint  = module.product_pricing_updated_handler.function_arn
}
