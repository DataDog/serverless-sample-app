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

variable "entry_point" {
  description = "The location of the main.go file for the Lambda function"
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

variable "enable_cloudwatch_logging" {
  default = false
  type    = bool
}
