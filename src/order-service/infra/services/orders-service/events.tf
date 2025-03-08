resource "aws_cloudwatch_event_bus" "orders_service_bus" {
  name = "OrdersService-bus-${var.env}"
}

resource "aws_ssm_parameter" "event_bus_name" {
  name  = "/${var.env}/OrdersService/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.orders_service_bus.name
}

resource "aws_ssm_parameter" "event_bus_arn" {
  name  = "/${var.env}/OrdersService/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.orders_service_bus.arn
}

data "aws_ssm_parameter" "shared_eb_name" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "shared_eb_arn" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-arn"
}


