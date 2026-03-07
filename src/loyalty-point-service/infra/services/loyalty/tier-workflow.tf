//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

################################################
######### Durable Tier Upgrade Workflow ########
################################################

# ---------------------------------------------------------------------------
# Lambda modules
# ---------------------------------------------------------------------------

module "fetch_order_history_activity_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/fetchOrderHistoryActivity/fetchOrderHistoryActivity.zip"
  function_name  = "FetchOrderHistoryActivity"
  lambda_handler = "index.handler"
  environment_variables = {
    "JWT_SECRET_PARAM_NAME"        = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/LoyaltyService/secret-access-key"
    "ORDER_SERVICE_ENDPOINT_PARAM" = "/${var.env}/OrderService/api-endpoint"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.tier_workflow_ssm_reads.arn,
  ]
}

module "tier_upgrade_orchestrator_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/tierUpgradeOrchestrator/tierUpgradeOrchestrator.zip"
  function_name  = "TierUpgradeOrchestrator"
  lambda_handler = "index.handler"
  environment_variables = {
    "TABLE_NAME"                          = aws_dynamodb_table.loyalty_table.name
    "EVENT_BUS_NAME"                      = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.loyalty_service_bus.name
    "FETCH_ORDER_HISTORY_ACTIVITY_ARN"    = "${module.fetch_order_history_activity_lambda.function_arn}:$LATEST"
    "PRODUCT_SERVICE_ENDPOINT_PARAM"      = "/${var.env}/ProductService/api-endpoint"
    "PRODUCT_SEARCH_ENDPOINT_PARAM"       = "/${var.env}/ProductSearchService/api-endpoint"
    "JWT_SECRET_PARAM_NAME"               = var.env == "dev" || var.env == "prod" ? "/${var.env}/shared/secret-access-key" : "/${var.env}/LoyaltyService/secret-access-key"
    "ORDER_SERVICE_ENDPOINT_PARAM"        = "/${var.env}/OrderService/api-endpoint"
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.dynamo_db_read.arn,
    aws_iam_policy.dynamo_db_write.arn,
    aws_iam_policy.eb_publish.arn,
    aws_iam_policy.durable_execution_orchestrator.arn,
    aws_iam_policy.invoke_fetch_order_history_activity.arn,
    aws_iam_policy.tier_workflow_ssm_reads.arn,
  ]
}

module "tier_upgrade_trigger_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/tierUpgradeTrigger/tierUpgradeTrigger.zip"
  function_name  = "TierUpgradeTrigger"
  lambda_handler = "index.handler"
  environment_variables = {
    "ORCHESTRATOR_FUNCTION_NAME" = module.tier_upgrade_orchestrator_lambda.function_name
  }
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.invoke_orchestrator.arn,
  ]
}

module "notification_acknowledger_lambda" {
  service_name   = "LoyaltyService"
  source         = "../../modules/lambda-function"
  zip_file       = "../out/notificationAcknowledger/notificationAcknowledger.zip"
  function_name  = "NotificationAcknowledger"
  lambda_handler = "index.handler"
  environment_variables = {}
  dd_api_key_secret_arn = var.dd_api_key_secret_arn
  dd_site               = var.dd_site
  app_version           = var.app_version
  env                   = var.env
  additional_policy_attachments = [
    aws_iam_policy.sqs_receive_policy.arn,
    aws_iam_policy.send_durable_callback.arn,
  ]
}

# ---------------------------------------------------------------------------
# IAM policies for the tier-upgrade workflow
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "durable_execution_orchestrator" {
  name = "tf-loyalty-durable-execution-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:CheckpointDurableExecution", "lambda:GetDurableExecutionState"]
      Resource = "${module.tier_upgrade_orchestrator_lambda.function_arn}:*"
    }]
  })
  depends_on = [module.tier_upgrade_orchestrator_lambda]
}

resource "aws_iam_policy" "invoke_orchestrator" {
  name = "tf-loyalty-invoke-orchestrator-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = module.tier_upgrade_orchestrator_lambda.function_arn
    }]
  })
  depends_on = [module.tier_upgrade_orchestrator_lambda]
}

resource "aws_iam_policy" "invoke_fetch_order_history_activity" {
  name = "tf-loyalty-invoke-fetch-order-history-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = [
        module.fetch_order_history_activity_lambda.function_arn,
        "${module.fetch_order_history_activity_lambda.function_arn}:*",
      ]
    }]
  })
  depends_on = [module.fetch_order_history_activity_lambda]
}

resource "aws_iam_policy" "tier_workflow_ssm_reads" {
  name = "tf-loyalty-tier-workflow-ssm-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:DescribeParameters",
        "ssm:GetParameter",
        "ssm:GetParameterHistory",
        "ssm:GetParameters",
      ]
      Resource = [
        var.env == "dev" || var.env == "prod" ? "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/shared/secret-access-key" : "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/LoyaltyService/secret-access-key",
        "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/OrderService/api-endpoint",
        "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/ProductService/api-endpoint",
        "arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.env}/ProductSearchService/api-endpoint",
      ]
    }]
  })
}

resource "aws_iam_policy" "send_durable_callback" {
  name = "tf-loyalty-send-durable-callback-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:SendDurableExecutionCallbackSuccess", "lambda:SendDurableExecutionCallbackFailure"]
      Resource = module.tier_upgrade_orchestrator_lambda.function_arn
    }]
  })
  depends_on = [module.tier_upgrade_orchestrator_lambda]
}

# ---------------------------------------------------------------------------
# TierUpgradeTrigger — SQS queues, EventBridge rules, ESM
# ---------------------------------------------------------------------------

resource "aws_sqs_queue" "tier_upgrade_trigger_dlq" {
  name = "LoyaltyService-TierUpgradeTriggerDLQ-${var.env}"
}

resource "aws_sqs_queue" "tier_upgrade_trigger_queue" {
  name                      = "LoyaltyService-TierUpgradeTrigger-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tier_upgrade_trigger_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_tier_upgrade_trigger_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "LoyaltyService_TierUpgradeTrigger_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.loyalty_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.loyalty_service_bus.name
  queue_arn       = aws_sqs_queue.tier_upgrade_trigger_queue.arn
  queue_name      = aws_sqs_queue.tier_upgrade_trigger_queue.name
  queue_id        = aws_sqs_queue.tier_upgrade_trigger_queue.id
  event_pattern   = <<EOF
{
  "detail-type": [
    "loyalty.pointsAdded.v2"
  ],
  "source": [
    "${var.env}.loyalty"
  ]
}
EOF
}

resource "aws_lambda_event_source_mapping" "tier_upgrade_trigger_queue_esm" {
  event_source_arn        = aws_sqs_queue.tier_upgrade_trigger_queue.arn
  function_name           = module.tier_upgrade_trigger_lambda.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}

# ---------------------------------------------------------------------------
# NotificationAcknowledger — SQS queues, EventBridge rules, ESM
# ---------------------------------------------------------------------------

resource "aws_sqs_queue" "notification_acknowledger_dlq" {
  name = "LoyaltyService-NotificationAcknowledgerDLQ-${var.env}"
}

resource "aws_sqs_queue" "notification_acknowledger_queue" {
  name                      = "LoyaltyService-NotificationAcknowledger-${var.env}"
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_acknowledger_dlq.arn
    maxReceiveCount     = 3
  })
}

module "shared_bus_notification_acknowledger_subscription" {
  source          = "../../modules/shared_bus_to_domain"
  rule_name       = "LoyaltyService_NotificationAcknowledger_Rule"
  env             = var.env
  shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : ""
  domain_bus_arn  = aws_cloudwatch_event_bus.loyalty_service_bus.arn
  domain_bus_name = aws_cloudwatch_event_bus.loyalty_service_bus.name
  queue_arn       = aws_sqs_queue.notification_acknowledger_queue.arn
  queue_name      = aws_sqs_queue.notification_acknowledger_queue.name
  queue_id        = aws_sqs_queue.notification_acknowledger_queue.id
  event_pattern   = <<EOF
{
  "detail-type": [
    "loyalty.tierUpgraded.v1"
  ],
  "source": [
    "${var.env}.loyalty"
  ]
}
EOF
}

resource "aws_lambda_event_source_mapping" "notification_acknowledger_queue_esm" {
  event_source_arn        = aws_sqs_queue.notification_acknowledger_queue.arn
  function_name           = module.notification_acknowledger_lambda.function_arn
  function_response_types = ["ReportBatchItemFailures"]
}
