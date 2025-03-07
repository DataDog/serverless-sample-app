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

resource "aws_iam_role_policy_attachment" "order_workflow_ddb_read_policy_attachment" {
  role       = aws_iam_role.order_workflow_sfn_role.id
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}

resource "aws_iam_role_policy_attachment" "order_workflow_ddb_write_policy_attachment" {
  role       = aws_iam_role.order_workflow_sfn_role.id
  policy_arn = aws_iam_policy.dynamo_db_write.arn
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
    EventBusName = var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name : aws_cloudwatch_event_bus.orders_service_bus.name
    Env = var.env
    ConfirmOrderLambda = module.confirm_order_handler.function_arn
    NoStockLambda = module.no_stock_handler.function_arn
  })
  tags = {
    DD_ENHANCED_METRICS : "true"
    DD_TRACE_ENABLED : "true"
  }
}