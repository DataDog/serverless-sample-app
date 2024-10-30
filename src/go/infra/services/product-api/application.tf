//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "api_gateway" {
  source            = "../../modules/api-gateway"
  api_name          = "tfgo-product-api-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
}

resource "aws_sns_topic" "product_created" {
  name = "tfgo-product-created-topic-${var.env}"
}

module "create_product_lambda" {
  service_name   = "GoProductApi"
  source         = "../../modules/lambda-function"
  entry_point    = "../src/product-api/create-product"
  function_name  = "GoCreateProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.go_product_api.name
    "PRODUCT_CREATED_TOPIC_ARN" : aws_sns_topic.product_created.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "create_product_lambda_dynamo_db_write" {
  role       = module.create_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_iam_role_policy_attachment" "create_product_lambda_sns_publish" {
  role       = module.create_product_lambda.function_role_name
  policy_arn = aws_iam_policy.sns_publish_create.arn
}

module "create_product_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.create_product_lambda.function_arn
  function_name = module.create_product_lambda.function_name
  http_method   = "POST"
  route         = "/product"
}

module "list_products_lambda" {
  service_name   = "GoProductApi"
  source         = "../../modules/lambda-function"
  entry_point    = "../src/product-api/list-products"
  function_name  = "GoListProducts"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.go_product_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "list_products_lambda_dynamo_db_read" {
  role       = module.list_products_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}


module "list_products_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.list_products_lambda.function_arn
  function_name = module.list_products_lambda.function_name
  http_method   = "GET"
  route         = "/product"
}

module "get_product_lambda" {
  service_name   = "GoProductApi"
  source         = "../../modules/lambda-function"
  entry_point    = "../src/product-api/get-product"
  function_name  = "GoGetProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.go_product_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "get_product_lambda_dynamo_db_read" {
  role       = module.get_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}


module "get_product_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.get_product_lambda.function_arn
  function_name = module.get_product_lambda.function_name
  http_method   = "GET"
  route         = "/product/{productId}"
}

resource "aws_sns_topic" "product_updated" {
  name = "product-updated-topic"
}

module "update_product_lambda" {
  service_name   = "GoProductApi"
  source         = "../../modules/lambda-function"
  entry_point    = "../src/product-api/update-product"
  function_name  = "GoUpdateProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.go_product_api.name
    "PRODUCT_UPDATED_TOPIC_ARN" : aws_sns_topic.product_updated.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "update_product_lambda_dynamo_db_read" {
  role       = module.update_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "update_product_lambda_dynamo_db_write" {
  role       = module.update_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_iam_role_policy_attachment" "update_product_lambda_sns_publish" {
  role       = module.update_product_lambda.function_role_name
  policy_arn = aws_iam_policy.sns_publish_update.arn
}

module "update_product_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.update_product_lambda.function_arn
  function_name = module.update_product_lambda.function_name
  http_method   = "PUT"
  route         = "/product"
}

resource "aws_sns_topic" "product_deleted" {
  name = "product-deleted-topic"
}

module "delete_product_lambda" {
  service_name   = "GoProductApi"
  source         = "../../modules/lambda-function"
  entry_point    = "../src/product-api/delete-product"
  function_name  = "GoDeleteProduct"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.go_product_api.name
    "PRODUCT_DELETED_TOPIC_ARN" : aws_sns_topic.product_deleted.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
}

resource "aws_iam_role_policy_attachment" "delete_product_lambda_dynamo_db_read" {
  role       = module.delete_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "delete_product_lambda_dynamo_db_write" {
  role       = module.delete_product_lambda.function_role_name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}

resource "aws_iam_role_policy_attachment" "delete_product_lambda_sns_publish" {
  role       = module.delete_product_lambda.function_role_name
  policy_arn = aws_iam_policy.sns_publish_delete.arn
}

module "delete_product_lambda_api" {
  source        = "../../modules/api-gateway-lambda-integration"
  api_id        = module.api_gateway.api_id
  api_arn       = module.api_gateway.api_arn
  function_arn  = module.delete_product_lambda.function_arn
  function_name = module.delete_product_lambda.function_name
  http_method   = "DELETE"
  route         = "/product/{productId}"
}

resource "aws_ssm_parameter" "product_created_topic_arn" {
  name  = "/go/product/${var.env}/product-created-topic"
  type  = "String"
  value = aws_sns_topic.product_created.arn
}

resource "aws_ssm_parameter" "product_updated_topic_arn" {
  name  = "/go/product/${var.env}/product-updated-topic"
  type  = "String"
  value = aws_sns_topic.product_updated.arn
}

resource "aws_ssm_parameter" "product_deleted_topic_arn" {
  name  = "/go/product/${var.env}/product-deleted-topic"
  type  = "String"
  value = aws_sns_topic.product_deleted.arn
}

resource "aws_ssm_parameter" "table_name_param" {
  name  = "/go/product/${var.env}/table-name"
  type  = "String"
  value = aws_dynamodb_table.go_product_api.name
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/go/product/${var.env}/api-endpoint"
  type  = "String"
  value = "${module.api_gateway.api_endpoint}/${var.env}"
}
