//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "product_stock_updated_topic" {
  name  = "/node/product/${var.env}/stock-updated-topic"
  type  = "String"
  value = aws_sns_topic.node_product_stock_updated.arn
}

resource "aws_ssm_parameter" "product_stock_updated_topic_name" {
  name  = "/node/product/${var.env}/stock-updated-topic-name"
  type  = "String"
  value = aws_sns_topic.node_product_stock_updated.name
}