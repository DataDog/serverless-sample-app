variable "env" {
  description = "The environment to deploy to"
  type        = string
}

variable "rule_name" {
  description = "The name of the rule"
  type = string
}

variable "function_name" {
  type = string
  description = "The name of the function to invoke"
  default = ""
}

variable "function_arn" {
  type = string
  description = "The Lambda function to invoke"
  default = ""
}

variable "queue_name" {
  type = string
  description = "The SQS queue name to send messages to"
  default = ""
}

variable "queue_arn" {
  type = string
  description = "The SQS queue ARN to send messages to"
  default = ""
}

variable "queue_id" {
  type = string
  description = "The SQS queue URL to send messages to"
  default = ""
}

variable "shared_bus_name" {
    description = "The name of the shared event bus"
    type        = string
    default = ""
}

variable "domain_bus_arn" {
  description = "The ARN of the domain bus"
  type        = string
}

variable "domain_bus_name" {
  description = "The name of the domain bus"
  type        = string
}

variable "event_pattern" {
  description = "The event to subscribe to"
  type        = string
}