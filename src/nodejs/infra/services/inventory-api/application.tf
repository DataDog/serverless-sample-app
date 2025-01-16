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
  name = "NodeInventoryApiTaskExecutionRole"

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

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  ]
}

resource "aws_iam_role" "ecs_task_role" {
  name = "NodeInventoryApiTaskRole"

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

resource "aws_ecs_task_definition" "main" {
  family                   = "main-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  container_definitions = jsonencode([
    {
      name  = "NodeInventoryApi"
      image = "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app:latest"
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]
      environment = [
        {
          name  = "TABLE_NAME"
          value = aws_dynamodb_table.node_inventory_api.name
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
        }
      ]
      secrets = [
        {
          name      = "SECRET_NAME"
          valueFrom = var.dd_api_key_secret_arn
        }
      ]
    },
    {
      name  = "DatadogAgent"
      image = "public.ecr.aws/datadog/agent:latest"
      portMappings = [
        {
          containerPort = 8125
          hostPort      = 8125
        },
        {
          containerPort = 8126
          hostPort      = 8126
        }
      ]
      environment = [
        {
          name  = "DD_SITE"
          value = var.dd_site
        },
        {
          name  = "ECS_FARGATE"
          value = "true"
        },
        {
          name  = "DD_LOGS_ENABLED"
          value = "false"
        },
        {
          name  = "DD_PROCESS_AGENT_ENABLED"
          value = "true"
        },
        {
          name  = "DD_APM_ENABLED"
          value = "true"
        },
        {
          name  = "DD_APM_NON_LOCAL_TRAFFIC"
          value = "true"
        },
        {
          name  = "DD_DOGSTATSD_NON_LOCAL_TRAFFIC"
          value = "false"
        },
        {
          name  = "DD_ECS_TASK_COLLECTION_ENABLED"
          value = "true"
        },
        {
          name  = "DD_ENV"
          value = var.env
        },
        {
          name  = "DD_SERVICE"
          value = "NodeInventoryApi"
        },
        {
          name  = "DD_VERSION"
          value = var.app_version
        },
        {
          name  = "DD_APM_IGNORE_RESOURCES"
          value = "GET /health"
        }
      ]
      secrets = [
        {
          name      = "DD_API_KEY"
          valueFrom = var.dd_api_key_secret_arn
        }
      ]
    }
  ])
}

resource "aws_ecs_service" "main" {
  name            = "main-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = [aws_subnet.private_subnet_1.id, aws_subnet.private_subnet_2.id]
    security_groups = [aws_security_group.ecs.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.target_group.arn
    container_name   = "NodeInventoryApi"
    container_port   = 3000
  }
}

resource "aws_ssm_parameter" "table_name_param" {
  name  = "/node/inventory/${var.env}/table-name"
  type  = "String"
  value = aws_dynamodb_table.node_inventory_api.name
}
