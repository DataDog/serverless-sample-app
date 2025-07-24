//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_secretsmanager_secret" "dd_api_key_secret" {
  name                    = "/${var.env}/shared/sls-sample-dd-api-key-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "dd_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.dd_api_key_secret.id
  secret_string = var.dd_api_key
}

module "order_mcp" {
  source                = "./services/order-mcp"
  dd_api_key_secret_arn = aws_secretsmanager_secret.dd_api_key_secret.arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
}
