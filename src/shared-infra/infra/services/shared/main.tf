//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_cloudwatch_event_bus" "shared_event_bus" {
  name = "SharedEventBus-${var.env}"
}

resource "aws_ssm_parameter" "eb_name" {
  name  = "/${var.env}/shared/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.shared_event_bus.name
}

resource "aws_ssm_parameter" "eb_name" {
  name  = "/${var.env}/shared/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.shared_event_bus.arn
}
