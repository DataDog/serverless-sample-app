//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

output "id" {
  value = aws_api_gateway_resource.cors_resource.id
}

output "path_part" {
  value = aws_api_gateway_resource.cors_resource.path_part
}

output "resource" {
  value = aws_api_gateway_resource.cors_resource
}