resource "aws_iam_role" "ecs_task_execution_role" {
  name = "TF_${var.service_name}_ex-${var.env}"

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

module "datadog_ecs_fargate_task" {
  source  = "DataDog/ecs-datadog/aws//modules/ecs_fargate"
  version = "0.2.0-beta"

  # Configure Datadog
  dd_api_key_secret = {
    arn = var.dd_api_key_secret_arn
  }
  dd_site                          = var.dd_site
  dd_service                       = var.service_name
  dd_essential                     = true
  dd_is_datadog_dependency_enabled = true

  dd_environment = [
    {
      name  = "ECS_FARGATE"
      value = "true"
    },
    {
      name  = "DD_LOGS_INJECTION"
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
    }
  ]

  dd_dogstatsd = {
    dogstatsd_cardinality    = "high",
    origin_detection_enabled = true,
  }

  dd_apm = {
    enabled = true,
  }

  dd_log_collection = {
    enabled = true,
    fluentbit_config = {
      is_log_router_dependency_enabled = true,
      is_log_router_essential = true,
      log_driver_configuration = {
        host_endpoint = "http-intake.logs.${var.dd_site}"
        tls = true
        service = var.service_name
        source_name = "java"
        message_key = "log"
      }
    }
  }

  # Configure Task Definition
  family = var.service_name
  container_definitions = jsonencode([
    {
      name  = var.service_name
      image = var.image
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
        }
      ]
      environment = var.environment_variables
      secrets = [
        {
          name      = "SECRET_NAME"
          valueFrom = var.dd_api_key_secret_arn
        }
      ]
    },
  ])
  volumes = []
  runtime_platform = {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
  requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"
  cpu = var.cpu
  memory = var.memory_size
  execution_role = {
    arn = aws_iam_role.ecs_task_execution_role.arn
  }
  task_role = {
    arn = aws_iam_role.ecs_task_role.arn
  }
}

resource "aws_ecs_service" "main" {
  name                  = var.service_name
  cluster               = var.ecs_cluster_id
  task_definition       = module.datadog_ecs_fargate_task.arn
  desired_count         = 1
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
