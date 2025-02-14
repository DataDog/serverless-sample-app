//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "api_id" {
  value = aws_api_gateway_rest_api.rest_api.id
}

output "api_arn" {
  value = aws_api_gateway_rest_api.rest_api.arn
}

output "root_resource_id" {
  value = aws_api_gateway_rest_api.rest_api.root_resource_id
}
