//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "inventory_ordering_service" {
  service_name   = "InventoryService"
  package_name = "com.inventory.ordering"
  source         = "../../modules/lambda-function"
  jar_file       = "../inventory-ordering-service/target/com.inventory.ordering-1.0.0-SNAPSHOT-aws.jar"
  function_name  = "Workflow"
  lambda_handler = "org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest"
  routing_expression = "handleNewProductAdded"
  environment_variables = {
    ORDERING_SERVICE_WORKFLOW_ARN : aws_sfn_state_machine.inventory_ordering_state_machine.arn
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  env = var.env
  app_version = var.app_version
  s3_bucket_name = aws_s3_bucket.lambda_code_storage_bucket.id
  additional_policy_attachments = [
    aws_iam_policy.sfn_start_execution.arn
  ]
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.inventory_ordering_service.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.java_inventory_new_product_added.arn
}

resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = aws_sns_topic.java_inventory_new_product_added.arn
  protocol  = "lambda"
  endpoint  = module.inventory_ordering_service.function_arn
}

resource "aws_cloudwatch_log_group" "sfn_log_group" {
  name              = "/aws/vendedlogs/states/InventoryOrderingServiceLogGroup-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}


resource "aws_sfn_state_machine" "inventory_ordering_state_machine" {
  name     = "InventoryOrdering-workflow-${var.env}"
  role_arn = aws_iam_role.invetory_ordering_sfn_role.arn
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_log_group.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  definition = templatefile("${path.module}/../../../cdk/src/main/java/com/cdk/inventory/ordering/workflows/workflow.setStock.asl.json", {
    TableName = aws_dynamodb_table.inventory_api.name
  })
  tags = {
    DD_ENHANCED_METRICS : "true"
    DD_TRACE_ENABLED : "true"
  }
}