resource "aws_cloudwatch_event_bus" "user_service_bus" {
  name = "${var.service_name}-bus-${var.env}"
}

resource "aws_ssm_parameter" "event_bus_name" {
  name  = "/${var.env}/${var.service_name}/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.user_service_bus.name
}

resource "aws_ssm_parameter" "event_bus_arn" {
  name  = "/${var.env}/${var.service_name}/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.user_service_bus.arn
}

data "aws_ssm_parameter" "shared_eb_name" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "shared_eb_arn" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-arn"
}


