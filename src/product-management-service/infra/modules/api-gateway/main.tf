//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

resource "aws_api_gateway_rest_api" "rest_api" {
  name = "${var.api_name}-${var.env}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}