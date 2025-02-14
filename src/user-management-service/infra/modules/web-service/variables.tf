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

variable "image" {
  description = "The full path to the image to use"
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

variable "environment_variables" {
  description = "Environment variables to pass to the Lambda function"
  type = list(object({
    value = string
    name  = string
  }))
}

variable "dd_api_key_secret_arn" {
  type = string
}

variable "dd_site" {
  default = "The Datadog site to use"
  type    = string
}

variable "cpu" {
  type    = string
  default = "256"
}

variable "memory_size" {
  type    = string
  default = "512"
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "ecs_cluster_id" {
  type = string
}

variable "subnet_ids" {
  type = set(string)
}

variable "security_group_ids" {
  type = set(string)
}

variable "target_group_arn" {
  type = string
}
