//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_sns_topic" "product_created" {
  name = "tf-java-product-created-topic-${var.env}"
}

resource "aws_sns_topic" "product_updated" {
  name = "tf-java-product-updated-topic-${var.env}"
}

resource "aws_sns_topic" "product_deleted" {
  name = "tf-java-product-deleted-topic-${var.env}"
}

resource "aws_ssm_parameter" "product_created_topic_arn" {
  name  = "/java/tf/${var.env}/product/product-created-topic"
  type  = "String"
  value = aws_sns_topic.product_created.arn
}

resource "aws_ssm_parameter" "product_updated_topic_arn" {
  name  = "/java/tf/${var.env}/product/product-updated-topic"
  type  = "String"
  value = aws_sns_topic.product_updated.arn
}

resource "aws_ssm_parameter" "product_deleted_topic_arn" {
  name  = "/java/tf/${var.env}/product/product-deleted-topic"
  type  = "String"
  value = aws_sns_topic.product_deleted.arn
}

resource "aws_ssm_parameter" "table_name_param" {
  name  = "/java/tf/${var.env}/product/table-name"
  type  = "String"
  value = aws_dynamodb_table.java_product_api.name
}

resource "aws_ecs_cluster" "main" {
  name = "product-api-cluster"
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "JavaProductApiTaskExecutionRole"

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
  name = "JavaProductApiTaskRole"

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
resource "aws_iam_role_policy_attachment" "inventory_api_create_topic" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.sns_publish_create.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_update_topic" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.sns_publish_update.arn
}
resource "aws_iam_role_policy_attachment" "inventory_api_delete_topic" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.sns_publish_delete.arn
}

module "inventory_api_web_service" {
  source       = "../../modules/web-service"
  service_name = "JavaInventoryApi"
  image        = "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-java:latest"
  env          = var.env
  app_version  = var.app_version
  environment_variables = [
    {
      name  = "TABLE_NAME"
      value = aws_dynamodb_table.java_product_api.name
    },
    {
      name  = "PRODUCT_CREATED_TOPIC_ARN"
      value = aws_sns_topic.product_created.arn
    },
    {
      name  = "PRODUCT_UPDATED_TOPIC_ARN"
      value = aws_sns_topic.product_updated.arn
    },
    {
      name  = "PRODUCT_DELETED_TOPIC_ARN"
      value = aws_sns_topic.product_deleted.arn
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
  name  = "/java/${var.env}/product/api-endpoint"
  type  = "String"
  value = "http://${aws_alb.application_load_balancer.dns_name}"
}
