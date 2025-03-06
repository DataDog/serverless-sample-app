resource "aws_cloudwatch_event_bus" "inventory_service_bus" {
  name = "InventoryService-bus-${var.env}"
}

resource "aws_ssm_parameter" "event_bus_name" {
  name  = "/${var.env}/InventoryService/event-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.inventory_service_bus.name
}

resource "aws_ssm_parameter" "event_bus_arn" {
  name  = "/${var.env}/InventoryService/event-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.inventory_service_bus.arn
}

data "aws_ssm_parameter" "shared_eb_name" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-name"
}

data "aws_ssm_parameter" "shared_eb_arn" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "/${var.env}/shared/event-bus-arn"
}

data "aws_iam_policy_document" "shared_eb_publish" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  statement {
    actions   = ["events:PutEvents"]
    resources = [
      aws_cloudwatch_event_bus.inventory_service_bus.arn,
      data.aws_ssm_parameter.shared_eb_arn[count.index].value
    ]
  }
}

resource "aws_iam_policy" "shared_eb_publish" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name   = "TF_InventoryOrdering-shared-eb-publish-policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.shared_eb_publish[count.index].json
}

resource "aws_iam_role" "shared_eb_publish_role" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name = "TF_InventoryOrdering-shared-eb-publish-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "shared_eb_publish_role_attachment" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  role       = aws_iam_role.shared_eb_publish_role[count.index].id
  policy_arn = aws_iam_policy.shared_eb_publish[count.index].arn
}

# Create events on inventory service event bus
resource "aws_cloudwatch_event_rule" "event_rule" {
  name           = "InventoryAclRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "product.productCreated.v1"
  ],
  "source": [
    "${var.env}.products"
  ]
}
EOF
}

resource "aws_cloudwatch_event_rule" "order_created_event_rule" {
  name           = "InventoryOrderCreatedRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "orders.orderCreated.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

resource "aws_cloudwatch_event_rule" "order_completed_event_rule" {
  name           = "InventoryOrderCompletedRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "orders.orderCompleted.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

# If running in an integrated environment also create the rules on the shared event bus to get public events into the internal bus
resource "aws_cloudwatch_event_rule" "shared_bus_event_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "InventoryAclRule"
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  event_pattern  = <<EOF
{
  "detail-type": [
    "product.productCreated.v1"
  ],
  "source": [
    "${var.env}.products"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_product_created_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_event_rule[count.index].name
  target_id      = aws_cloudwatch_event_bus.inventory_service_bus.id
  arn            = aws_cloudwatch_event_bus.inventory_service_bus.arn
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

resource "aws_cloudwatch_event_rule" "shared_bus_order_created_event_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "InventoryOrderCreatedRule"
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  event_pattern  = <<EOF
{
  "detail-type": [
    "orders.orderCreated.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_order_created_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_order_created_event_rule[count.index].name
  target_id      = aws_cloudwatch_event_bus.inventory_service_bus.id
  arn            = aws_cloudwatch_event_bus.inventory_service_bus.arn
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

resource "aws_cloudwatch_event_rule" "shared_bus_order_completed_event_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "InventoryOrderCompletedRule"
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  event_pattern  = <<EOF
{
  "detail-type": [
    "orders.orderCompleted.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_order_completed_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_order_completed_event_rule[count.index].name
  target_id      = aws_cloudwatch_event_bus.inventory_service_bus.id
  arn            = aws_cloudwatch_event_bus.inventory_service_bus.arn
  event_bus_name = data.aws_ssm_parameter.shared_eb_name[count.index].value
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

# If running in an integrated environment also create forwarding rules to push inventory service events onto the bus
resource "aws_cloudwatch_event_rule" "shared_bus_out_of_stock_forwarding_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "OutOfStockForwardingRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.outOfStock.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_out_of_stock_forwarding_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_out_of_stock_forwarding_rule[count.index].name
  target_id      = data.aws_ssm_parameter.shared_eb_name[count.index].value
  arn            = data.aws_ssm_parameter.shared_eb_arn[count.index].value
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.id
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

resource "aws_cloudwatch_event_rule" "shared_bus_stock_reserved_forwarding_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "StockReservedForwardingRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockReserved.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_stock_reserved_forwarding_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_stock_reserved_forwarding_rule[count.index].name
  target_id      = data.aws_ssm_parameter.shared_eb_name[count.index].value
  arn            = data.aws_ssm_parameter.shared_eb_arn[count.index].value
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.id
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

resource "aws_cloudwatch_event_rule" "shared_bus_stock_updated_forwarding_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "StockUpdatedForwardingRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockUpdated.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_stock_updated_forwarding_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_stock_updated_forwarding_rule[count.index].name
  target_id      = data.aws_ssm_parameter.shared_eb_name[count.index].value
  arn            = data.aws_ssm_parameter.shared_eb_arn[count.index].value
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.id
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

resource "aws_cloudwatch_event_rule" "shared_bus_reservation_failed_forwarding_rule" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  name           = "ReservationFailedForwardingRule"
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.name
  event_pattern  = <<EOF
{
  "detail-type": [
    "inventory.stockReservationFailed.v1"
  ],
  "source": [
    "${var.env}.inventory"
  ]
}
EOF
}

resource "aws_cloudwatch_event_target" "shared_bus_reservation_failed_forwarding_target" {
  count = var.env == "dev" || var.env == "prod" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_reservation_failed_forwarding_rule[count.index].name
  target_id      = data.aws_ssm_parameter.shared_eb_name[count.index].value
  arn            = data.aws_ssm_parameter.shared_eb_arn[count.index].value
  event_bus_name = aws_cloudwatch_event_bus.inventory_service_bus.id
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}
