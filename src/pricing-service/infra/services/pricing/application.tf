//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "pricing_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/PricingService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}

module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "PricingService-API-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

module "pricing_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "pricing"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

module "calculate_pricing_lambda" {
  service_name   = "PricingService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/calculatePricingFunction/calculatePricingFunction.zip"
  function_name  = "CalculatePricing"
  lambda_handler = "index.handler"
  environment_variables = {
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/PricingService/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

module "calculate_pricing_lambda_api" {
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.calculate_pricing_lambda.function_invoke_arn
  function_name     = module.calculate_pricing_lambda.function_name
  http_method       = "POST"
  api_resource_id   = module.pricing_resource.id
  api_resource_path = module.pricing_resource.path_part
  env               = var.env
}

resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = module.api_gateway.api_id
  depends_on  = [module.calculate_pricing_lambda_api]
  triggers = {
    redeployment = sha1(jsonencode([
      module.calculate_pricing_lambda_api
    ]))
  }
  variables = {
    deployed_at = "${timestamp()}"
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "rest_api_stage" {
  deployment_id = aws_api_gateway_deployment.rest_api_deployment.id
  rest_api_id   = module.api_gateway.api_id
  stage_name    = var.env
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/PricingService/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.rest_api_stage.invoke_url
}
