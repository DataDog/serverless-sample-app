//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ecs_cluster" "main" {
  name = "main-cluster"
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "GoInventoryApiTaskExecutionRole"

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
  name = "GoInventoryApiTaskRole"

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
resource "aws_iam_role_policy_attachment" "inventory_api_db__writeaccess" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.dynamo_db_write.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_put_events" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.eb_publish.arn
}

module "inventory_api_web_service" {
  source       = "../../modules/web-service"
  service_name = "GoInventoryApi"
  image        = "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-go:latest"
  env          = var.env
  app_version  = var.app_version
  environment_variables = [
    {
      name  = "TABLE_NAME"
      value = aws_dynamodb_table.go_inventory_api.name
    },
    {
      name  = "EVENT_BUS_NAME"
      value = data.aws_ssm_parameter.eb_name.value
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
      name  = "DD_ENV"
      value = var.env
    },

    {
      name  = "DD_SERVICE"
      value = "GoInventoryApi"
    },

    {
      name  = "DD_VERSION"
      value = var.app_version
    },

    {
      name  = "RUST_LOG"
      value = "info"
    },
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

resource "aws_ssm_parameter" "table_name_param" {
  name  = "/go/inventory/${var.env}/table-name"
  type  = "String"
  value = aws_dynamodb_table.go_inventory_api.name
}
