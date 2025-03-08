resource "aws_iam_role" "order_workflow_sfn_role" {
  name = "OrderService-sfn-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "logging_policy" {
  name = "TF_OrderService-logging-policy-${var.env}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
          "logs:CreateLogDelivery",
          "logs:CreateLogStream",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ],
        Effect : "Allow",
        Resource : "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "order_workflow_logging_policy_attachment" {
  role       = aws_iam_role.order_workflow_sfn_role.id
  policy_arn = aws_iam_policy.logging_policy.arn
}

resource "aws_iam_role_policy_attachment" "order_workflow_function_invoke_policy_attachment" {
  role       = aws_iam_role.order_workflow_sfn_role.id
  policy_arn = aws_iam_policy.order_workflow_function_invoke.arn
}

resource "aws_iam_role_policy_attachment" "order_workflow_eb_publish_policy_attachment" {
  role       = aws_iam_role.order_workflow_sfn_role.id
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_cloudwatch_log_group" "sfn_log_group" {
  name              = "/aws/vendedlogs/states/OrderService-orders-${var.env}"
  retention_in_days = 7
  lifecycle {
    prevent_destroy = false
  }
}

resource "aws_sfn_state_machine" "order_workflow_state_machine" {
  name     = "OrderService-orders-${var.env}"
  role_arn = aws_iam_role.order_workflow_sfn_role.arn
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_log_group.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  definition = templatefile("${path.module}/../../../cdk/workflows/orderProcessingWorkflow.asl.json", {
    TableName = aws_dynamodb_table.orders_api.name
    EventBusName = var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    Env = var.env
    ConfirmOrderLambda = module.confirm_order_handler.function_arn
    NoStockLambda = module.no_stock_handler.function_arn
  })
  tags = {
    DD_ENHANCED_METRICS : "true"
    DD_TRACE_ENABLED : "true"
  }
}

module "confirm_order_handler" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "ConfirmOrders"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationSuccess_Generated::ReservationSuccess"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.step_functions_interactions.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn
  ]
}

module "no_stock_handler" {
  source         = "../../modules/lambda-function"
  publish_directory = "../src/Orders.BackgroundWorkers/bin/Release/net8.0/Orders.BackgroundWorkers.zip"
  service_name   = "OrdersService"
  function_name  = "NoStock"
  lambda_handler = "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationFailed_Generated::ReservationFailed"
  environment_variables = {
    EVENT_BUS_NAME : var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    TABLE_NAME : aws_dynamodb_table.orders_api.name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site = var.dd_site
  app_version = var.app_version
  env = var.env
  additional_policy_attachments = [
    aws_iam_policy.step_functions_interactions.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn
  ]
}