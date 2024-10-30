//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_cloudwatch_event_bus" "shared_go_bus" {
  name = "TfGo-ProductEventBus-${var.env}"
}

resource "aws_ssm_parameter" "eb_name" {
  name  = "/go/shared/${var.env}/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.shared_go_bus.name
}
