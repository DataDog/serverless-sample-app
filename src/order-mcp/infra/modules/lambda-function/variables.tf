//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "service_name" {
  description = "The name of the service"
  type        = string
}

variable "env" {
  description = "The deployment environment"
  type        = string
}

variable "app_version" {
  default     = "latest"
  description = "The version of the deployment"
  type        = string
}

variable "zip_file" {
  description = "The location of the ZIP file"
  type        = string
}

variable "function_name" {
  description = "The name of the Lambda function"
  type        = string
}

variable "lambda_handler" {
  description = "The Lambda handler, defined as classlib::namespace.class::method"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables to pass to the Lambda function"
  type        = map(string)
}

variable "dd_api_key_secret_arn" {
  type = string
}

variable "dd_site" {
  default = "The Datadog site to use"
  type    = string
}

variable "function_timeout" {
  type    = number
  default = 29
}

variable "memory_size" {
  type    = number
  default = 512
}

variable "additional_policy_attachments" {
  type = list(string)
  default = []
}

variable "custom_layers" {
  description = "Additional custom layers to attach to the Lambda function"
  type        = list(string)
  default     = []
}
