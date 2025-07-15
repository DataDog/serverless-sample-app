//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# JWT secret parameter for non-integrated environments
resource "aws_ssm_parameter" "jwt_secret_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/OrderMcpService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
  
  tags = {
    Environment = var.env
    Service     = "OrderMcpService"
    Version     = var.app_version
  }
}

# Reference to shared JWT secret for integrated environments
data "aws_ssm_parameter" "shared_jwt_secret" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name  = "/${var.env}/shared/secret-access-key"
}

# HTTP API Gateway
module "http_api_gateway" {
  source            = "../../modules/http-api-gateway"
  api_name          = "OrderMcpService-API-${var.env}"
  service_name      = "OrderMcpService"
  stage_name        = "$default"
  stage_auto_deploy = true
  env               = var.env
}

# Order MCP Server Lambda Function
module "order_mcp_server_lambda" {
  service_name   = "OrderMcpService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/order-mcp/order-mcp.zip"
  function_name  = "OrderMcpFunction"
  lambda_handler = "run.sh"
  memory_size    = 512
  function_timeout = 29
  
  environment_variables = {
    "AUTH_SERVER_PARAMETER_NAME" = "/${var.env}/Users/api-endpoint"
    "MCP_SERVER_ENDPOINT_PARAMETER_NAME" = "/${var.env}/OrderMcpService/api-endpoint"
    "JWT_SECRET_PARAM_NAME" = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/OrderMcpService/secret-access-key"
    "DD_TRACE_PARTIAL_FLUSH_MIN_SPANS" = "1"
    "DD_TRACE_PARTIAL_FLUSH_ENABLED" = "false"
    "AWS_LAMBDA_EXEC_WRAPPER" = "/opt/bootstrap"
    "AWS_LWA_PORT" = "3000"
  }
  
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  
  # Custom layers including Lambda Web Adapter
  custom_layers = [
    "arn:aws:lambda:${data.aws_region.current.name}:753240598075:layer:LambdaAdapterLayerX86:25"
  ]
  
  additional_policy_attachments = [
    aws_iam_policy.get_jwt_ssm_parameter.arn,
    aws_iam_policy.ssm_external_services_access.arn,
    aws_iam_policy.kms_ssm_decrypt.arn
  ]
}

# Custom Authorizer Lambda Function
module "order_mcp_authorizer_lambda" {
  service_name   = "OrderMcpService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/authorizerFunction/authorizerFunction.zip"
  function_name  = "OrderMcpAuthorizerFunction"
  lambda_handler = "index.handler"
  memory_size    = 512
  function_timeout = 29
  
  environment_variables = {
    "JWT_SECRET_PARAM_NAME" = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/OrderMcpService/secret-access-key"
  }
  
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  
  additional_policy_attachments = [
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

# Lambda integration with HTTP API Gateway
module "order_mcp_lambda_integration" {
  source              = "../../modules/http-api-lambda-integration"
  api_id              = module.http_api_gateway.api_id
  api_arn             = module.http_api_gateway.api_arn
  function_name       = module.order_mcp_server_lambda.function_name
  function_invoke_arn = module.order_mcp_server_lambda.function_invoke_arn
}

# Data source for current AWS region
data "aws_region" "current" {}

# SSM parameter for API endpoint
resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/OrderMcpService/api-endpoint"
  type  = "String"
  value = module.http_api_gateway.stage_invoke_url
  
  tags = {
    Environment = var.env
    Service     = "OrderMcpService"
    Version     = var.app_version
  }
}