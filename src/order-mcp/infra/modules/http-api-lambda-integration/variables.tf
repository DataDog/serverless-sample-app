//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "api_id" {
  type        = string
  description = "ID of the HTTP API Gateway"
}

variable "api_arn" {
  type        = string
  description = "ARN of the HTTP API Gateway"
}

variable "function_name" {
  type        = string
  description = "Name of the Lambda function"
}

variable "function_invoke_arn" {
  type        = string
  description = "Invoke ARN of the Lambda function"
}