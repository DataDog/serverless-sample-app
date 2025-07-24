//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_apigatewayv2_api" "http_api" {
  name          = var.api_name
  protocol_type = "HTTP"
  description   = "HTTP API Gateway for ${var.api_name}"

  cors_configuration {
    allow_headers  = ["*"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins  = ["*"]
    max_age        = 86400 # 1 day
  }

  tags = {
    Name        = var.api_name
    Environment = var.env
    Service     = var.service_name
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = var.stage_name
  auto_deploy = var.stage_auto_deploy

  tags = {
    Name        = "${var.api_name}-${var.stage_name}"
    Environment = var.env
    Service     = var.service_name
  }
}