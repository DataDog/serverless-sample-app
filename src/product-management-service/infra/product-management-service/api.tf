//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "product_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/${var.service_name}/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}

module "api_gateway" {
  source            = "../modules/api-gateway"
  api_name          = "${var.service_name}Api"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

module "product_resource" {
  source             = "../modules/api-gateway-cors-resource"
  path_part          = "product"
  parent_resource_id = module.api_gateway.root_resource_id
  rest_api_id        = module.api_gateway.api_id
}

module "product_id_resource" {
  source             = "../modules/api-gateway-cors-resource"
  path_part          = "{productId}"
  parent_resource_id = module.product_resource.id
  rest_api_id        = module.api_gateway.api_id
}

resource "aws_sns_topic" "product_created" {
  name = "product-created-topic-${var.env}"
}

module "create_product_lambda" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/create-product"
  function_name  = "CreateProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.product_api.name
    "PRODUCT_CREATED_TOPIC_ARN" : aws_sns_topic.product_created.arn
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn,
    aws_iam_policy.sns_publish_create.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

module "create_product_lambda_api" {
  source            = "../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.create_product_lambda.function_invoke_arn
  function_name     = module.create_product_lambda.function_name
  http_method       = "POST"
  api_resource_id   = module.product_resource.id
  api_resource_path = module.product_resource.path_part
  env               = var.env
}
module "list_products_lambda" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/list-products"
  function_name  = "ListProducts"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.product_api.name
    "PRODUCT_CREATED_TOPIC_ARN" : aws_sns_topic.product_created.arn
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn,
    aws_iam_policy.sns_publish_create.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

module "list_products_lambda_api" {
  source            = "../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.list_products_lambda.function_invoke_arn
  function_name     = module.list_products_lambda.function_name
  http_method       = "GET"
  api_resource_id   = module.product_resource.id
  api_resource_path = module.product_id_resource.path_part
  env               = var.env
}

module "get_product_lambda" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/get-product"
  function_name  = "GetProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.product_api.name
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.allow_jwt_secret_access.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

module "get_product_lambda_api" {
  source            = "../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.get_product_lambda.function_invoke_arn
  function_name     = module.get_product_lambda.function_name
  http_method       = "GET"
  api_resource_id   = module.product_id_resource.id
  api_resource_path = module.product_id_resource.path_part
  env               = var.env
}

resource "aws_sns_topic" "product_updated" {
  name = "product-updated-topic"
}

module "update_product_lambda" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/update-product"
  function_name  = "UpdateProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.product_api.name
    "PRODUCT_UPDATED_TOPIC_ARN" : aws_sns_topic.product_updated.arn
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn,
    aws_iam_policy.sns_publish_update.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

module "update_product_lambda_api" {
  source            = "../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.update_product_lambda.function_invoke_arn
  function_name     = module.update_product_lambda.function_name
  http_method       = "PUT"
  api_resource_id   = module.product_resource.id
  api_resource_path = module.product_resource.path_part
  env               = var.env
}

resource "aws_sns_topic" "product_deleted" {
  name = "product-deleted-topic"
}

module "delete_product_lambda" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/delete-product"
  function_name  = "DeleteProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.product_api.name
    "PRODUCT_DELETED_TOPIC_ARN" : aws_sns_topic.product_deleted.arn
    "JWT_SECRET_PARAM_NAME" : var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/${var.service_name}/secret-access-key"
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.allow_jwt_secret_access.arn,
    aws_iam_policy.sns_publish_delete.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

module "delete_product_lambda_api" {
  source            = "../modules/api-gateway-lambda-integration"
  api_id            = module.api_gateway.api_id
  api_arn           = module.api_gateway.api_arn
  function_arn      = module.delete_product_lambda.function_invoke_arn
  function_name     = module.delete_product_lambda.function_name
  http_method       = "DELETE"
  api_resource_id   = module.product_id_resource.id
  api_resource_path = module.product_id_resource.path_part
  env               = var.env
}

resource "aws_api_gateway_deployment" "rest_api_deployment" {
  rest_api_id = module.api_gateway.api_id
  depends_on = [module.delete_product_lambda_api,
    module.create_product_lambda_api,
    module.update_product_lambda_api,
    module.get_product_lambda_api,
    module.list_products_lambda_api
  ]
  triggers = {
    redeployment = sha1(jsonencode([
      module.delete_product_lambda_api,
      module.create_product_lambda_api,
      module.update_product_lambda_api,
      module.get_product_lambda_api,
      module.list_products_lambda_api,
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
  name  = "/${var.env}/${var.service_name}/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.rest_api_stage.invoke_url
}
