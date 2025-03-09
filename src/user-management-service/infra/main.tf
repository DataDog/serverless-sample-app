//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

# Deploying multiple independent services from a single TF file is not recommended, this is for demonstration purposes only

resource "aws_secretsmanager_secret" "dd_api_key_secret" {
  name = "/${var.env}/UserManagementService/dd-api-key"
}

resource "aws_secretsmanager_secret_version" "dd_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.dd_api_key_secret.id
  secret_string = var.dd_api_key
}

module "user_management_service" {
  source                = "./services/user-management-service"
  dd_api_key_secret_arn = aws_secretsmanager_secret.dd_api_key_secret.arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
}