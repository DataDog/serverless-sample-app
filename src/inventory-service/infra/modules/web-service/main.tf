resource "aws_iam_role" "ecs_task_execution_role" {
  name = "TF_${var.service_name}_exec-${var.env}"

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
  name = "TF_${var.service_name}_tk-${var.env}"

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

resource "aws_iam_role_policy_attachment" "additional_policy_attachments" {
  count      = length(var.additional_task_role_policy_attachments)
  role       = aws_iam_role.ecs_task_role.id
  policy_arn = var.additional_task_role_policy_attachments[count.index]
}

resource "aws_iam_role_policy_attachment" "additional_execution_role_policy_attachments" {
  count      = length(var.additional_execution_role_policy_attachments)
  role       = aws_iam_role.ecs_task_execution_role.id
  policy_arn = var.additional_execution_role_policy_attachments[count.index]
}

resource "aws_ecs_task_definition" "main" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory_size
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name  = var.service_name
      image = var.image
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          appProtocol  = "http"
          protocol = "tcp"
          name: "inventory-api"
        }
      ]
      essential = true
      environment = var.environment_variables
      secrets = [
        {
          name      = "SECRET_NAME"
          valueFrom = var.dd_api_key_secret_arn
        }
      ]
      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          Name           = "datadog"
          Host           = "http-intake.logs.${var.dd_site}"
          TLS            = "on"
          dd_service     = var.service_name
          dd_source      = "expressjs",
          dd_message_key = "log",
          provider       = "ecs",
          apikey         = data.aws_secretsmanager_secret_version.current_api_key_secret.secret_string
        }
      }
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
          value = var.service_name
        },
        {
          name  = "DD_VERSION"
          value = var.app_version
        },
        {
          name  = "DD_APM_IGNORE_RESOURCES"
          value = "GET /"
        }
      ]
      secrets = [
        {
          name      = "DD_API_KEY"
          valueFrom = var.dd_api_key_secret_arn
        }
      ]
    },
    {
      name      = "log-router"
      image     = "amazon/aws-for-fluent-bit:latest"
      essential = true
      firelensConfiguration = {
        type = "fluentbit"
        options = {
          enable-ecs-log-metadata = "true"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "main" {
  name                  = var.service_name
  cluster               = var.ecs_cluster_id
  task_definition       = aws_ecs_task_definition.main.arn
  desired_count         = 2
  launch_type           = "FARGATE"
  wait_for_steady_state = true
  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
  }
  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = 8080
  }
}
