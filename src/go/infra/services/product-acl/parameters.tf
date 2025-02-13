//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "product_stock_updated_topic_arn" {
  name  = "/go/product/${var.env}/inventory-stock-updated-topic"
  type  = "String"
  value = aws_sns_topic.go_product_stock_level_updated.arn
}

resource "aws_ssm_parameter" "product_stock_updated_topic_name" {
  name  = "/go/product/${var.env}/inventory-stock-updated-topic-name"
  type  = "String"
  value = aws_sns_topic.go_product_stock_level_updated.name
}