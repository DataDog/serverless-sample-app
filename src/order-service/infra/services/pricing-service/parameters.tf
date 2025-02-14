//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_ssm_parameter" "product_pricing_changed_topic_arn" {
  name  = "/dotnet/tf/${var.env}/product/pricing-calculated-topic"
  type  = "String"
  value = aws_sns_topic.product_price_calculated.arn
}


resource "aws_ssm_parameter" "product_pricing_changed_topic_name" {
  name  = "/dotnet/tf/${var.env}/product/pricing-calculated-topic-name"
  type  = "String"
  value = aws_sns_topic.product_price_calculated.name
}
