//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "user_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/${var.service_name}/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}

module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "${var.service_name}-API-${var.env}"
  env               = var.env
}

# HTTP API doesn't require explicit resource creation - routes are defined directly in integrations

module "register_user_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/registerUserFunction/registerUserFunction.zip"
  function_name  = "RegisterUser"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "EVENT_BUS_NAME": var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.user_service_bus.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "register_user_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.register_user_function.function_invoke_arn
  function_name = module.register_user_function.function_name
  http_method   = "POST"
  route_path    = "/user"
  env           = var.env
}

module "login_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/loginFunction/loginFunction.zip"
  function_name  = "Login"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
    "TOKEN_EXPIRATION" : 86400
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "login_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.login_function.function_invoke_arn
  function_name = module.login_function.function_name
  http_method   = "POST"
  route_path    = "/login"
  env           = var.env
}

module "get_user_details_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/getUserDetailsFunction/getUserDetailsFunction.zip"
  function_name  = "GetUserDetails"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
    "TOKEN_EXPIRATION" : 86400
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "get_user_details_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.get_user_details_function.function_invoke_arn
  function_name = module.get_user_details_function.function_name
  http_method   = "GET"
  route_path    = "/user/{userId}"
  env           = var.env
}

# OAuth Authorization Server Well-Known Endpoint
module "oauth_metadata_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthMetadataFunction/oauthMetadataFunction.zip"
  function_name  = "OAuthMetadata"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_metadata_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_metadata_function.function_invoke_arn
  function_name = module.oauth_metadata_function.function_name
  http_method   = "GET"
  route_path    = "/.well-known/oauth-authorization-server"
  env           = var.env
}

# OAuth Authorization Endpoint
module "oauth_authorize_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthAuthorizeFunction/oauthAuthorizeFunction.zip"
  function_name  = "OAuthAuthorize"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_authorize_function_api_get" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_authorize_function.function_invoke_arn
  function_name = module.oauth_authorize_function.function_name
  http_method   = "GET"
  route_path    = "/oauth/authorize"
  env           = var.env
}

module "oauth_authorize_function_api_post" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_authorize_function.function_invoke_arn
  function_name = module.oauth_authorize_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/authorize"
  env           = var.env
}

# OAuth Authorization Callback Endpoint
module "oauth_authorize_callback_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthAuthorizeCallbackFunction/oauthAuthorizeCallbackFunction.zip"
  function_name  = "OAuthAuthorizeCallback"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_authorize_callback_function_api_get" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_authorize_callback_function.function_invoke_arn
  function_name = module.oauth_authorize_callback_function.function_name
  http_method   = "GET"
  route_path    = "/oauth/authorize/callback"
  env           = var.env
}

module "oauth_authorize_callback_function_api_post" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_authorize_callback_function.function_invoke_arn
  function_name = module.oauth_authorize_callback_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/authorize/callback"
  env           = var.env
}

# OAuth Token Endpoint
module "oauth_token_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthTokenFunction/oauthTokenFunction.zip"
  function_name  = "OAuthToken"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_token_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_token_function.function_invoke_arn
  function_name = module.oauth_token_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/token"
  env           = var.env
}

# OAuth Introspect Endpoint
module "oauth_introspect_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthIntrospectFunction/oauthIntrospectFunction.zip"
  function_name  = "OAuthIntrospect"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_introspect_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_introspect_function.function_invoke_arn
  function_name = module.oauth_introspect_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/introspect"
  env           = var.env
}

# OAuth Revoke Endpoint
module "oauth_revoke_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthRevokeFunction/oauthRevokeFunction.zip"
  function_name  = "OAuthRevoke"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_revoke_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_revoke_function.function_invoke_arn
  function_name = module.oauth_revoke_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/revoke"
  env           = var.env
}

# OAuth Dynamic Client Registration (DCR) Endpoint
module "oauth_dcr_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthDcrFunction/oauthDcrFunction.zip"
  function_name  = "OAuthDcr"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_dcr_function_api_client" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_dcr_function.function_invoke_arn
  function_name = module.oauth_dcr_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/client"
  env           = var.env
}

module "oauth_dcr_function_api_register" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_dcr_function.function_invoke_arn
  function_name = module.oauth_dcr_function.function_name
  http_method   = "POST"
  route_path    = "/oauth/register"
  env           = var.env
}

# OAuth Client Get Endpoint
module "oauth_client_get_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthClientGetFunction/oauthClientGetFunction.zip"
  function_name  = "OAuthClientGet"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_client_get_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_client_get_function.function_invoke_arn
  function_name = module.oauth_client_get_function.function_name
  http_method   = "GET"
  route_path    = "/oauth/client/{clientId}"
  env           = var.env
}

# OAuth Client Update Endpoint
module "oauth_client_update_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthClientUpdateFunction/oauthClientUpdateFunction.zip"
  function_name  = "OAuthClientUpdate"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_client_update_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_client_update_function.function_invoke_arn
  function_name = module.oauth_client_update_function.function_name
  http_method   = "PUT"
  route_path    = "/oauth/client/{clientId}"
  env           = var.env
}

# OAuth Client Delete Endpoint
module "oauth_client_delete_function" {
  service_name   = var.service_name
  source         = "../../modules/lambda-function"
  zip_file       = "../out/oauthClientDeleteFunction/oauthClientDeleteFunction.zip"
  function_name  = "OAuthClientDelete"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn
  ]
}

module "oauth_client_delete_function_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.oauth_client_delete_function.function_invoke_arn
  function_name = module.oauth_client_delete_function.function_name
  http_method   = "DELETE"
  route_path    = "/oauth/client/{clientId}"
  env           = var.env
}

# HTTP API auto-deploys, no need for manual deployment and stage resources

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/${var.service_name}/api-endpoint"
  type  = "String"
  value = "${module.api_gateway.api_endpoint}/"
}
