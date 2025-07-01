//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "product_api_pricing_worker" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/handle-pricing-changed"
  function_name  = "ProductApiPricingChangedWorker"
  lambda_handler = "index.handler"
  environment_variables = {
    TABLE_NAME : aws_dynamodb_table.product_api.name
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.current.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

resource "aws_lambda_permission" "product_pricing_changed_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_api_pricing_worker.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.product_price_calculated.arn
}

resource "aws_sns_topic_subscription" "price_calculated_sns_topic_subscription" {
  topic_arn = aws_sns_topic.product_price_calculated.arn
  protocol  = "lambda"
  endpoint  = module.product_api_pricing_worker.function_arn
}

module "product_api_stock_updated_worker" {
  service_name   = var.service_name
  source         = "../modules/lambda-function"
  entry_point    = "../src/product-api/handle-stock-updated"
  function_name  = "StockUpdated"
  lambda_handler = "index.handler"
  environment_variables = {
    TABLE_NAME : aws_dynamodb_table.product_api.name
    "DSQL_CLUSTER_ENDPOINT" : "${aws_dsql_cluster.product_api_dsql.identifier}.dsql.${data.aws_region.current.name}.on.aws"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.dsql_connect.arn
  ]
}

resource "aws_lambda_permission" "stock_updated_changed_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.product_api_stock_updated_worker.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.product_stock_level_updated.arn
}

resource "aws_sns_topic_subscription" "inventory_stock_updated_sns_topic_subscription" {
  topic_arn = aws_sns_topic.product_stock_level_updated.arn
  protocol  = "lambda"
  endpoint  = module.product_api_stock_updated_worker.function_arn
}
