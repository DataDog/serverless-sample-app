//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# SSM parameter for JWT secret access key (non-integrated environments only)
resource "aws_ssm_parameter" "activity_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/ActivityService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production"

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# API Gateway
module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "tf-python-activity-api-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

# Activity resource (/api/activity)
module "api_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "api"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

# Activity resource (/api/activity)
module "activity_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "activity"
  parent_resource_id = module.api_resource.id
  rest_api_id        = module.api_gateway.api_id
}

# Entity type resource (/api/activity/{entity_type})
module "entity_type_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "{entity_type}"
  parent_resource_id = module.activity_resource.id
  rest_api_id        = module.api_gateway.api_id
}

# Entity ID resource (/api/activity/{entity_type}/{entity_id})
module "entity_id_resource" {
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "{entity_id}"
  parent_resource_id = module.entity_type_resource.id
  rest_api_id        = module.api_gateway.api_id
}

# Get Activity Lambda Function
module "get_activity_lambda" {
  service_name              = "ActivityService"
  source                    = "../../modules/python-lambda-function"
  zip_file                  = "../.build/activity_service.zip"
  layer_zip_file            = "../.build/common_layer.zip"
  function_name             = "GetActivity"
  lambda_handler            = "activity_service.handlers.handle_get_activity.lambda_handler"
  dd_api_key_secret_arn     = var.dd_api_key_secret_arn
  dd_site                   = var.dd_site
  app_version               = var.app_version
  env                       = var.env
  function_timeout          = 29
  memory_size               = 512
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.activities_table.name
    "IDEMPOTENCY_TABLE_NAME" : aws_dynamodb_table.idempotency_table.name
  }
  additional_policy_attachments = [
    aws_iam_policy.activities_table_read.arn,
    aws_iam_policy.idempotency_table_read.arn,
    aws_iam_policy.idempotency_table_write.arn,
    aws_iam_policy.appconfig_access.arn,
    aws_iam_policy.get_jwt_ssm_parameter.arn
  ]
}

# API Gateway integration for Get Activity
module "get_activity_lambda_api" {
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.get_activity_lambda.function_invoke_arn
  function_name     = module.get_activity_lambda.function_name
  http_method       = "GET"
  api_resource_id   = module.entity_id_resource.id
  api_resource_path = module.entity_id_resource.path_part
  env               = var.env
}

# Handle Events Lambda Function (SQS processor)
module "handle_events_lambda" {
  service_name              = "ActivityService"
  source                    = "../../modules/python-lambda-function"
  zip_file                  = "../.build/activity_service.zip"
  layer_zip_file            = "../.build/common_layer.zip"
  function_name             = "HandleEvents"
  lambda_handler            = "activity_service.handlers.create_activity.lambda_handler"
  dd_api_key_secret_arn     = var.dd_api_key_secret_arn
  dd_site                   = var.dd_site
  app_version               = var.app_version
  env                       = var.env
  function_timeout          = 29
  memory_size               = 512
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.activities_table.name
    "IDEMPOTENCY_TABLE_NAME" : aws_dynamodb_table.idempotency_table.name
  }
  additional_policy_attachments = [
    aws_iam_policy.activities_table_read.arn,
    aws_iam_policy.activities_table_write.arn,
    aws_iam_policy.idempotency_table_read.arn,
    aws_iam_policy.idempotency_table_write.arn,
    aws_iam_policy.appconfig_access.arn,
    aws_iam_policy.sqs_receive_delete.arn,
    aws_iam_policy.eventbridge_publish.arn
  ]
}

# Lambda event source mapping for SQS
resource "aws_lambda_event_source_mapping" "sqs_event_source" {
  event_source_arn                   = aws_sqs_queue.activity_queue.arn
  function_name                      = module.handle_events_lambda.function_arn
  batch_size                         = 10
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 5

  depends_on = [
    aws_iam_policy.sqs_receive_delete,
    module.handle_events_lambda
  ]
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = module.api_gateway.api_id
  depends_on = [
    module.get_activity_lambda_api
  ]
  triggers = {
    redeployment = sha1(jsonencode([
      module.get_activity_lambda_api
    ]))
  }
  variables = {
    deployed_at = timestamp()
  }
  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway stage
resource "aws_api_gateway_stage" "rest_api_stage" {
  deployment_id = aws_api_gateway_deployment.rest_api_deployment.id
  rest_api_id   = module.api_gateway.api_id
  stage_name    = var.env

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}

# SSM parameter for API endpoint
resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/ActivityService/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.rest_api_stage.invoke_url

  tags = {
    Environment = var.env
    Service     = "ActivityService"
  }
}