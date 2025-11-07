data "aws_iam_policy_document" "test_harness_dynamo_db_read" {
  count = var.env == "prod" ? 0 : 1
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:DescribeTable"]
    resources = [aws_dynamodb_table.test_harness_api[count.index].arn, "${aws_dynamodb_table.test_harness_api[count.index].arn}/*"]
  }
}

data "aws_iam_policy_document" "test_harness_dynamo_db_write" {
  count = var.env == "prod" ? 0 : 1
  statement {
    actions = ["dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
    "dynamodb:DescribeTable"]
    resources = [aws_dynamodb_table.test_harness_api[count.index].arn, "${aws_dynamodb_table.test_harness_api[count.index].arn}/*"]
  }
}

resource "aws_iam_policy" "test_harness_dynamo_db_read" {
  count  = var.env == "prod" ? 0 : 1
  name   = "tf-orders-test-dynamo_db_read_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.test_harness_dynamo_db_read[count.index].json
}

resource "aws_iam_policy" "test_harness_dynamo_db_write" {
  count  = var.env == "prod" ? 0 : 1
  name   = "tf-orders-test-api-dynamo_db_write_policy-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.test_harness_dynamo_db_write[count.index].json
}

resource "aws_dynamodb_table" "test_harness_api" {
  count        = var.env == "prod" ? 0 : 1
  name         = "OrdersService-TestEventHarness-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
}

module "event_harness_api_gateway" {
  count             = var.env == "prod" ? 0 : 1
  source            = "../../modules/api-gateway"
  api_name          = "OrdersService-test-event-harness-${var.env}"
  stage_name        = var.env
  stage_auto_deploy = true
  env               = var.env
}

module "event_resource" {
  count              = var.env == "prod" ? 0 : 1
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "events"
  parent_resource_id = module.event_harness_api_gateway[count.index].root_resource_id
  rest_api_id        = module.event_harness_api_gateway[count.index].api_id
}

module "event_id_resource" {
  count              = var.env == "prod" ? 0 : 1
  source             = "../../modules/api-gateway-cors-resource"
  path_part          = "{eventId}"
  parent_resource_id = module.event_resource[count.index].id
  rest_api_id        = module.event_harness_api_gateway[count.index].api_id
}

module "event_harness_api_lambda" {
  count             = var.env == "prod" ? 0 : 1
  publish_directory = "../src/TestHarness/TestHarness.Lambda/bin/Release/net8.0/TestHarness.Lambda.zip"
  service_name      = "OrdersService-TestHarness"
  source            = "../../modules/lambda-function"
  function_name     = "TestHarnessApi"
  lambda_handler    = "TestHarness.Lambda::TestHarness.Lambda.ApiFunctions_GetReceivedEvents_Generated::GetReceivedEvents"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.test_harness_api[count.index].name
    "KEY_PROPERTY_NAME" : "orderNumber"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
}

resource "aws_iam_role_policy_attachment" "event_harness_api_lambda_dynamo_db_read" {
  count      = var.env == "prod" ? 0 : 1
  role       = module.event_harness_api_lambda[count.index].function_role_name
  policy_arn = aws_iam_policy.test_harness_dynamo_db_read[count.index].arn
}

resource "aws_iam_role_policy_attachment" "event_harness_api_lambda_dynamo_db_write" {
  count      = var.env == "prod" ? 0 : 1
  role       = module.event_harness_api_lambda[count.index].function_role_name
  policy_arn = aws_iam_policy.test_harness_dynamo_db_write[count.index].arn
}

module "event_harness_lambda_api" {
  count             = var.env == "prod" ? 0 : 1
  source            = "../../modules/api-gateway-lambda-integration"
  api_id            = module.event_harness_api_gateway[count.index].api_id
  api_arn           = module.event_harness_api_gateway[count.index].api_arn
  function_arn      = module.event_harness_api_lambda[count.index].function_invoke_arn
  function_name     = module.event_harness_api_lambda[count.index].function_name
  http_method       = "GET"
  api_resource_id   = module.event_id_resource[count.index].id
  api_resource_path = module.event_id_resource[count.index].path_part
  env               = var.env
}

resource "aws_api_gateway_deployment" "event_harness_api_deployment" {
  count       = var.env == "prod" ? 0 : 1
  rest_api_id = module.event_harness_api_gateway[count.index].api_id
  depends_on  = [module.event_harness_lambda_api]
  triggers = {
    redeployment = sha1(jsonencode([
      module.event_harness_api_lambda,
    ]))
  }
  variables = {
    deployed_at = "${timestamp()}"
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "event_harness_api_stage" {
  count         = var.env == "prod" ? 0 : 1
  deployment_id = aws_api_gateway_deployment.event_harness_api_deployment[count.index].id
  rest_api_id   = module.event_harness_api_gateway[count.index].api_id
  stage_name    = var.env
}

module "event_harness_event_bridge_lambda" {
  count             = var.env == "prod" ? 0 : 1
  publish_directory = "../src/TestHarness/TestHarness.Lambda/bin/Release/net8.0/TestHarness.Lambda.zip"
  service_name      = "OrdersService-TestHarness"
  source            = "../../modules/lambda-function"
  function_name     = "TestHarnessEventBridge"
  lambda_handler    = "TestHarness.Lambda::TestHarness.Lambda.HandlerFunctions_HandleEventBridge_Generated::HandleEventBridge"
  environment_variables = {
    "TABLE_NAME" : aws_dynamodb_table.test_harness_api[count.index].name
    "KEY_PROPERTY_NAME" : "orderNumber"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  env                   = var.env
  app_version           = var.app_version
}

resource "aws_iam_role_policy_attachment" "event_harness_eb_lambda_dynamo_db_read" {
  count      = var.env == "prod" ? 0 : 1
  role       = module.event_harness_event_bridge_lambda[count.index].function_role_name
  policy_arn = aws_iam_policy.test_harness_dynamo_db_read[count.index].arn
}

resource "aws_iam_role_policy_attachment" "event_harness_eb_lambda_dynamo_db_write" {
  count      = var.env == "prod" ? 0 : 1
  role       = module.event_harness_event_bridge_lambda[count.index].function_role_name
  policy_arn = aws_iam_policy.test_harness_dynamo_db_write[count.index].arn
}

##################################################
########## Event Bridge Rules and Targets ########
##################################################
## ORDER CREATED
module "shared_bus_order_created_subscription" {
  count           = var.env == "prod" ? 0 : 1
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "OrderCreated_TestHarness_Rule"
  env             = var.env
  shared_bus_name = var.env == "prod" || var.env == "dev" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  function_arn    = module.event_harness_event_bridge_lambda[count.index].function_arn
  function_name   = module.event_harness_event_bridge_lambda[count.index].function_name
  event_pattern   = <<EOF
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

# ORDER CONFIRMED
module "shared_bus_order_confirmed_subscription" {
  count           = var.env == "prod" ? 0 : 1
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "OrderConfirmed_TestHarness_Rule"
  env             = var.env
  shared_bus_name = var.env == "prod" || var.env == "dev" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  function_arn    = module.event_harness_event_bridge_lambda[count.index].function_arn
  function_name   = module.event_harness_event_bridge_lambda[count.index].function_name
  event_pattern   = <<EOF
{
  "detail-type": [
    "orders.orderConfirmed.v1"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

# ORDER COMPLETED
module "shared_bus_order_completed_subscription" {
  count           = var.env == "prod" ? 0 : 1
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "OrderCompleted_TestHarness_Rule"
  env             = var.env
  shared_bus_name = var.env == "prod" || var.env == "dev" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  function_arn    = module.event_harness_event_bridge_lambda[count.index].function_arn
  function_name   = module.event_harness_event_bridge_lambda[count.index].function_name
  event_pattern   = <<EOF
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

# ORDER COMPLETED V2
module "shared_bus_order_completed_v2_subscription" {
  count           = var.env == "prod" ? 0 : 1
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "OrderCompletedV2_TestHarness_Rule"
  env             = var.env
  shared_bus_name = var.env == "prod" || var.env == "dev" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.orders_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.orders_service_bus.name
  function_arn    = module.event_harness_event_bridge_lambda[count.index].function_arn
  function_name   = module.event_harness_event_bridge_lambda[count.index].function_name
  event_pattern   = <<EOF
{
  "detail-type": [
    "orders.orderCompleted.v2"
  ],
  "source": [
    "${var.env}.orders"
  ]
}
EOF
}

resource "aws_ssm_parameter" "test_harness_api_endpoint" {
  count = var.env == "prod" ? 0 : 1
  name  = "/${var.env}/OrdersService_TestHarness/api-endpoint"
  type  = "String"
  value = aws_api_gateway_stage.event_harness_api_stage[count.index].invoke_url
}
