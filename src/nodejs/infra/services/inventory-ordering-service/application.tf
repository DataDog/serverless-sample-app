//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

module "inventory_ordering_service" {
  service_name   = "NodeInventoryOrderingService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/inventoryOrderingWorkflowTrigger/inventoryOrderingWorkflowTrigger.zip"
  function_name  = "InventoryOrderingService"
  lambda_handler = "index.handler"
  environment_variables = {
    ORDERING_SERVICE_WORKFLOW_ARN : aws_sfn_state_machine.inventory_ordering_state_machine.arn
    DD_SERVICE_MAPPING : "lambda_sns:${data.aws_ssm_parameter.product_added_topic.value}"
    DOMAIN : "inventory"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
}

resource "aws_iam_role_policy_attachment" "product_created_handler_sqs_receive_permission" {
  role       = module.inventory_ordering_service.function_role_name
  policy_arn = aws_iam_policy.sfn_start_execution.arn
}

resource "aws_lambda_permission" "product_created_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = module.inventory_ordering_service.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = data.aws_ssm_parameter.product_added_topic.value
}

resource "aws_sns_topic_subscription" "product_created_sns_topic" {
  topic_arn = data.aws_ssm_parameter.product_added_topic.value
  protocol  = "lambda"
  endpoint  = module.inventory_ordering_service.function_arn
}

resource "aws_cloudwatch_log_group" "sfn_log_group" {
  name              = "/aws/vendedlogs/states/NodeInventoryOrderingServiceLogGroup-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}


resource "aws_sfn_state_machine" "inventory_ordering_state_machine" {
  name     = "tf-node-inventory-ordering-service-${var.env}"
  role_arn = aws_iam_role.invetory_ordering_sfn_role.arn
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_log_group.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }
  definition = templatefile("${path.module}/../../../lib/inventory-ordering-service/workflows/workflow.setStock.asl.json", {
    TableName = data.aws_ssm_parameter.inventory_table_name.value
  })
  tags = {
    DD_ENHANCED_METRICS : "true"
    DD_TRACE_ENABLED : "true"
  }
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/node/${var.env}/inventory-ordering/state-machine-arn"
  type  = "String"
  value = aws_sfn_state_machine.inventory_ordering_state_machine.arn
}
