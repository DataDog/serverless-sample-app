//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "UserManagementService-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

module "user_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "user"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

module "user_id_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "{userId}"
  parent_resource_id = module.user_resource.id
  rest_api_id        = module.api_gateway.api_id
}

module "login_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "login"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

resource "aws_sns_topic" "user_created" {
  name = "UserCreated-${var.env}"
}

module "register_user_function" {
  service_name   = "UserManagementService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/registerUserFunction/registerUserFunction.zip"
  function_name  = "RegisterUser"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "USER_CREATED_TOPIC_ARN" : aws_sns_topic.user_created.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
}

resource "aws_iam_role_policy_attachment" "register_user_function_dynamo_db_read" {
  role       = module.register_user_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "register_user_function_dynamo_db_write" {
  role       = module.register_user_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_iam_role_policy_attachment" "register_user_function_sns_publish" {
  role       = module.register_user_function.function_role_name
  policy_arn = aws_iam_policy.sns_publish_create.arn
}

module "register_user_function_api" {
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.register_user_function.function_invoke_arn
  function_name     = module.register_user_function.function_name
  http_method       = "POST"
  api_resource_id   = module.user_resource.id
  api_resource_path = module.user_resource.path_part
  env               = var.env
}

module "login_function" {
  service_name   = "UserManagementService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/loginFunction/loginFunction.zip"
  function_name  = "Login"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME": "/${var.env}/shared/secret-access-key"
    "TOKEN_EXPIRATION": 86400
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
}

resource "aws_iam_role_policy_attachment" "login_function_dynamo_db_read" {
  role       = module.login_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "login_function_jwt_param_read" {
  role       = module.login_function.function_role_name
  policy_arn = aws_iam_policy.allow_jwt_secret_access.arn
}


module "login_function_api" {
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.login_function.function_invoke_arn
  function_name     = module.login_function.function_name
  http_method       = "POST"
  api_resource_id   = module.login_resource.id
  api_resource_path = module.login_resource.path_part
  env               = var.env
}

module "get_user_details_function" {
  service_name   = "UserManagementService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/getUserDetailsFunction/getUserDetailsFunction.zip"
  function_name  = "GetUserDetails"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.user_management_table.name
    "JWT_SECRET_PARAM_NAME": "/${var.env}/shared/secret-access-key"
    "TOKEN_EXPIRATION": 86400
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
}

resource "aws_iam_role_policy_attachment" "get_user_details_function_dynamo_db_read" {
  role       = module.get_user_details_function.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "get_user_details_function_jwt_param_read" {
  role       = module.get_user_details_function.function_role_name
  policy_arn = aws_iam_policy.allow_jwt_secret_access.arn
}


module "get_user_details_function_api" {
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.get_user_details_function.function_invoke_arn
  function_name     = module.get_user_details_function.function_name
  http_method       = "GET"
  api_resource_id   = module.user_id_resource.id
  api_resource_path = module.user_id_resource.path_part
  env               = var.env
}

resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = module.api_gateway.api_id
  depends_on = [module.register_user_function_api,
    module.login_function_api,
    module.get_user_details_function_api,
  ]
  triggers = {
    redeployment = sha1(jsonencode([
      module.register_user_function_api,
      module.login_function_api,
      module.get_user_details_function_api
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
  name  = "/UserManagementService/${var.env}/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.rest_api_stage.invoke_url
}
