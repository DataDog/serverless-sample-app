//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# CatalogSync Lambda Function
module "catalog_sync_lambda" {
  source                = "../../modules/python-lambda-function"
  service_name          = "ProductSearchService"
  zip_file              = "../../../.build/product_search_service.zip"
  function_name         = "product-search-service-catalog-sync-${var.env}"
  lambda_handler        = "product_search_service.handlers.catalog_sync.lambda_handler"
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  function_timeout      = 29
  memory_size           = 512

  environment_variables = {
    "POWERTOOLS_SERVICE_NAME"                    = "product-search-service"
    "POWERTOOLS_LOG_LEVEL"                       = "INFO"
    "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT"      = "ignore"
    "DD_TRACE_PROPAGATION_STYLE_EXTRACT"         = "none"
    "DD_BOTOCORE_DISTRIBUTED_TRACING"            = "false"
    "DD_DATA_STREAMS_ENABLED"                    = "true"
    "DD_LLMOBS_ENABLED"                          = "1"
    "DD_LLMOBS_ML_APP"                           = "product-search-service"
    "VECTOR_BUCKET_NAME"                         = "serverless-sample-app-vector-${var.env}"
    "METADATA_TABLE_NAME"                        = aws_dynamodb_table.product_search_metadata_table.name
    "PRODUCT_API_ENDPOINT_PARAMETER"             = "/${var.env}/ProductService/api-endpoint"
    "EMBEDDING_MODEL_ID"                         = "amazon.titan-embed-text-v2:0"
    "ENV"                                        = var.env
  }

  additional_policy_attachments = [
    aws_iam_policy.catalog_sync_dynamodb_policy.arn,
    aws_iam_policy.catalog_sync_bedrock_policy.arn,
    aws_iam_policy.catalog_sync_ssm_policy.arn,
    aws_iam_policy.catalog_sync_s3_vectors_policy.arn,
    aws_iam_policy.catalog_sync_sqs_policy.arn,
  ]
}

# SQS event source mapping for CatalogSync Lambda
resource "aws_lambda_event_source_mapping" "catalog_sync_sqs_event_source" {
  event_source_arn        = aws_sqs_queue.catalog_sync_queue.arn
  function_name           = module.catalog_sync_lambda.function_arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]

  depends_on = [
    aws_iam_policy.catalog_sync_sqs_policy,
    module.catalog_sync_lambda
  ]
}

# ProductSearch Lambda Function
module "product_search_lambda" {
  source                = "../../modules/python-lambda-function"
  service_name          = "ProductSearchService"
  zip_file              = "../../../.build/product_search_service.zip"
  function_name         = "product-search-service-product-search-${var.env}"
  lambda_handler        = "product_search_service.handlers.product_search.lambda_handler"
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  function_timeout      = 29
  memory_size           = 512

  environment_variables = {
    "POWERTOOLS_SERVICE_NAME"               = "product-search-service"
    "POWERTOOLS_LOG_LEVEL"                  = "INFO"
    "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT" = "ignore"
    "DD_TRACE_PROPAGATION_STYLE_EXTRACT"    = "none"
    "DD_BOTOCORE_DISTRIBUTED_TRACING"       = "false"
    "DD_DATA_STREAMS_ENABLED"               = "true"
    "DD_LLMOBS_ENABLED"                     = "1"
    "DD_LLMOBS_ML_APP"                      = "product-search-service"
    "VECTOR_BUCKET_NAME"                    = "serverless-sample-app-vector-${var.env}"
    "METADATA_TABLE_NAME"                   = aws_dynamodb_table.product_search_metadata_table.name
    "EMBEDDING_MODEL_ID"                    = "amazon.titan-embed-text-v2:0"
    "GENERATION_MODEL_ID"                   = "anthropic.claude-3-5-haiku-20241022-v1:0"
    "SEARCH_TOP_K"                          = "5"
    "ENV"                                   = var.env
  }

  additional_policy_attachments = [
    aws_iam_policy.product_search_dynamodb_policy.arn,
    aws_iam_policy.product_search_bedrock_policy.arn,
    aws_iam_policy.product_search_s3_vectors_policy.arn,
  ]
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "search_api" {
  name          = "tf-python-product-search-api-${var.env}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# API Gateway stage with auto-deploy
resource "aws_apigatewayv2_stage" "search_api_stage" {
  api_id      = aws_apigatewayv2_api.search_api.id
  name        = var.env
  auto_deploy = true

  tags = {
    Environment = var.env
    Service     = "ProductSearchService"
  }
}

# Lambda integration for ProductSearch
resource "aws_apigatewayv2_integration" "product_search_integration" {
  api_id                 = aws_apigatewayv2_api.search_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.product_search_lambda.function_invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /search
resource "aws_apigatewayv2_route" "search_route" {
  api_id    = aws_apigatewayv2_api.search_api.id
  route_key = "POST /search"
  target    = "integrations/${aws_apigatewayv2_integration.product_search_integration.id}"
}

# Lambda permission for API Gateway to invoke the ProductSearch function
resource "aws_lambda_permission" "apigw_invoke_product_search" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.product_search_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.search_api.execution_arn}/*/*/search"
}
