//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ecs_cluster" "main" {
  name = "Orders-cluster-${var.env}"
}

resource "aws_ssm_parameter" "orders_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/OrdersService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}

module "orders_web_service" {
  source       = "../../modules/web-service"
  service_name = "ordersservice"
  image        = "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-dotnet:${var.app_version}"
  env          = var.env
  app_version  = var.app_version
  environment_variables = [
    {
      name  = "JWT_SECRET_PARAM_NAME"
      value = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/OrdersService/secret-access-key"
    },
    {
      name  = "TABLE_NAME"
      value = aws_dynamodb_table.orders_api.name
    },
    {
      name  = "EVENT_BUS_NAME"
      value = var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.orders_service_bus.name
    },
    {
      name  = "ORDER_WORKFLOW_ARN"
      value = aws_sfn_state_machine.order_workflow_state_machine.arn
    },
    {
      name  = "TEAM"
      value = "orders"
    },
    {
      name  = "DOMAIN"
      value = "orders"
    },
    {
      name  = "ENV"
      value = var.env
    },
    {
      name  = "DD_LOGS_INJECTION"
      value = "true"
    }
  ]
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  ecs_cluster_id        = aws_ecs_cluster.main.id
  subnet_ids            = [aws_subnet.private_subnet_1.id, aws_subnet.private_subnet_2.id]
  security_group_ids    = [aws_security_group.ecs_sg.id]
  target_group_arn      = aws_lb_target_group.target_group.arn
  additional_execution_role_policy_attachments = [
    aws_iam_policy.get_api_key_secret.arn
  ]
  additional_task_role_policy_attachments = [
    aws_iam_policy.get_jwt_ssm_parameter.arn,
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.step_functions_interactions.arn,
    aws_iam_policy.get_jwt_ssm_parameter.arn,
    aws_iam_policy.eb_publish.arn
  ]
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/OrdersService/api-endpoint"
  type  = "String"
  value = "http://${aws_alb.application_load_balancer.dns_name}"
}

