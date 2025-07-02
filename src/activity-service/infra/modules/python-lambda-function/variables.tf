//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

variable "service_name" {
  type        = string
  description = "The name of the service"
}

variable "env" {
  type        = string
  description = "The deployment environment"
}

variable "app_version" {
  type        = string
  description = "The version of the application being deployed"
  default     = "latest"
}

variable "zip_file" {
  type        = string
  description = "The path to the Lambda function zip file"
}

variable "layer_zip_file" {
  type        = string
  description = "The path to the Lambda layer zip file (optional)"
  default     = null
}

variable "function_name" {
  type        = string
  description = "The name of the Lambda function"
}

variable "lambda_handler" {
  type        = string
  description = "The handler function for the Lambda"
}

variable "environment_variables" {
  type        = map(string)
  description = "Environment variables for the Lambda function"
  default     = {}
}

variable "dd_api_key_secret_arn" {
  type        = string
  description = "The ARN of the Datadog API key secret"
}

variable "dd_site" {
  type        = string
  description = "The Datadog site to use"
}

variable "function_timeout" {
  type        = number
  description = "The timeout for the Lambda function in seconds"
  default     = 29
}

variable "memory_size" {
  type        = number
  description = "The memory size for the Lambda function in MB"
  default     = 512
}

variable "additional_policy_attachments" {
  type        = list(string)
  description = "Additional IAM policy ARNs to attach to the Lambda role"
  default     = []
}

variable "additional_layers" {
  type        = list(string)
  description = "Additional Lambda layer ARNs to attach to the function"
  default     = []
}