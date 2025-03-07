//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ecs_cluster" "main" {
  name = "InventoryOrdering-cluster-${var.env}"
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "TF_InventoryApiTaskExecutionRole-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task_role" {
  name = "TF_InventoryApiTaskRole-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "inventory_api_get_secret" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.get_api_key_secret.arn
}

resource "aws_iam_role_policy_attachment" "inventory_api_db_read_access" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.dynamo_db_read.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_read_ssm" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.allow_jwt_secret_access.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_db__writeaccess" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_put_events" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.eb_publish.arn
}

resource "aws_ssm_parameter" "inventory_service_access_key" {
  count = var.env == "dev" || var.env == "prod" ? 0 : 1
  name  = "/${var.env}/InventoryService/secret-access-key"
  type  = "String"
  value = "This is a sample secret key that should not be used in production`"
}


module "inventory_api_web_service" {
  source       = "../../modules/web-service"
  service_name = "InventoryApi"
  image        = "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-inventory-java:latest"
  env          = var.env
  app_version  = var.app_version
  environment_variables = [
    {
      name  = "TABLE_NAME"
      value = aws_dynamodb_table.inventory_api.name
    },
    {
      name  = "EVENT_BUS_NAME"
      value = var.env == "dev" || var.env == "prod" ?  data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.inventory_service_bus.name
    },
    {
      name  = "TEAM"
      value = "inventory"
    },
    {
      name  = "DOMAIN"
      value = "inventory"
    },
    {
      name  = "ENV"
      value = var.env
    },
    {
      name  = "DD_LOGS_INJECTION"
      value = "true"
    },
    {
      name  = "JWT_SECRET_PARAM_NAME"
      value = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/InventoryService/secret-access-key"
    }
  ]
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  execution_role_arn    = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn         = aws_iam_role.ecs_task_role.arn
  ecs_cluster_id        = aws_ecs_cluster.main.id
  subnet_ids            = [aws_subnet.private_subnet_1.id, aws_subnet.private_subnet_2.id]
  security_group_ids    = [aws_security_group.ecs_sg.id]
  target_group_arn      = aws_lb_target_group.target_group.arn
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/${var.env}/InventoryService/api-endpoint"
  type  = "String"
  value = "http://${aws_alb.application_load_balancer.dns_name}"
}