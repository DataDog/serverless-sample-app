//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "loyalty_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/LoyaltyService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}

module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "tf-node-product-api-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

module "loyalty_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "loyalty"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

module "get_loyalty_points_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/getLoyaltyAccountFunction/getLoyaltyAccountFunction.zip"
  function_name  = "GetLoyaltyPoints"
  lambda_handler = "index.handler"
  environment_variables = {
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/LoyaltyService/secret-access-key"
    "TABLE_NAME" : aws_dynamodb_table.loyalty_table.name
    "EVENT_BUS_NAME": var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.loyalty_service_bus.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

module "get_loyalty_points_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.get_loyalty_points_lambda.function_invoke_arn
  function_name = module.get_loyalty_points_lambda.function_name
  http_method   = "GET"
  api_resource_id   = module.loyalty_resource.id
  api_resource_path = module.loyalty_resource.path_part
  env = var.env
}

module "spend_loyalty_points_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/spendLoyaltyPointsFunction/spendLoyaltyPointsFunction.zip"
  function_name  = "SpendLoyaltyPoints"
  lambda_handler = "index.handler"
  environment_variables = {
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/LoyaltyService/secret-access-key"
    "TABLE_NAME" : aws_dynamodb_table.loyalty_table.name
    "DD_TRACE_DYNAMODB_TABLE_PRIMARY_KEYS": "{\"${aws_dynamodb_table.loyalty_table.id}\": [\"PK\"]}"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

module "spend_loyalty_points_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.spend_loyalty_points_lambda.function_invoke_arn
  function_name = module.spend_loyalty_points_lambda.function_name
  http_method   = "POST"
  api_resource_id   = module.loyalty_resource.id
  api_resource_path = module.loyalty_resource.path_part
  env = var.env
}

resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = module.api_gateway.api_id
  depends_on = [module.spend_loyalty_points_lambda_api, module.get_loyalty_points_lambda_api]
  triggers = {
    redeployment = sha1(jsonencode([
      module.spend_loyalty_points_lambda_api,
      module.get_loyalty_points_lambda_api
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

module "loyalty_points_updated_handler" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/handleLoyaltyPointsUpdated/handleLoyaltyPointsUpdated.zip"
  function_name  = "HandleLoyaltyPointsUpdated"
  lambda_handler = "index.handler"
  environment_variables = {
    "EVENT_BUS_NAME": var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.loyalty_service_bus.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

resource "aws_lambda_event_source_mapping" "dynamo_db_stream_esm" {
  event_source_arn  = aws_dynamodb_table.loyalty_table.stream_arn
  function_name     = module.loyalty_points_updated_handler.function_arn
  starting_position = "LATEST"
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/LoyaltyService/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.rest_api_stage.invoke_url
}
