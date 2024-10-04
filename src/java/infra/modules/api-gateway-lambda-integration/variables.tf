//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "api_id" {
  description = "The ID of the HTTP API to attach to."
  type        = string
}

variable "api_arn" {
  description = "The ARN of the HTTP API to attach to."
  type        = string
}

variable "api_resource_id" {
  description = "The API Gateway resource."
  type        = string
}

variable "api_resource_path" {
  description = "The path of the API Gateway resource."
  type        = string
}

variable "function_arn" {
  description = "The ARN of the Lambda function."
  type        = string
}

variable "function_name" {
  description = "The name of the Lambda function."
  type        = string
}

variable "http_method" {
  description = "The HTTP method to use (GET, PUT, POST, DELETE)."
  type        = string
}

variable "env" {
  description = "The environment to use."
  type        = string
}