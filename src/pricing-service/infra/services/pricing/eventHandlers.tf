
# //
# // Unless explicitly stated otherwise all files in this repository are licensed
# // under the Apache License Version 2.0.
# // This product includes software developed at Datadog (https://www.datadoghq.com/).
# // Copyright 2024 Datadog, Inc.
# //

# data "aws_iam_policy_document" "sqs_receive" {
#   statement {
#     actions = ["sqs:ReceiveMessage",
#       "sqs:DeleteMessage",
#     "sqs:GetQueueAttributes"]
#     resources = [
#       aws_sqs_queue.product_created_queue.arn,
#       aws_sqs_queue.product_updated_queue.arn
#     ]
#   }
# }

# resource "aws_iam_policy" "sqs_receive_policy" {
#   name   = "tf-pricing-sqs-receive-${var.env}"
#   path   = "/"
#   policy = data.aws_iam_policy_document.sqs_receive.json
# }

# resource "aws_sqs_queue" "product_created_dlq" {
#   name = "PricingService-ProductCreatedDLQ-${var.env}"
# }

# resource "aws_sqs_queue" "product_created_queue" {
#   name                      = "PricingService-ProductCreated-${var.env}"
#   receive_wait_time_seconds = 10
#   redrive_policy = jsonencode({
#     deadLetterTargetArn = aws_sqs_queue.product_created_dlq.arn
#     maxReceiveCount     = 3
#   })
# }

# module "shared_bus_stock_reserved_subscription" {
#   count           = var.env == "dev" || var.env == "prod" ? 1 : 0
#   source          = "../../modules/shared_bus_to_domain"
#   rule_name       = "PricingService_ProductCreated_Rule"
#   env             = var.env
#   shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[count.index].value : ""
#   domain_bus_arn  = aws_cloudwatch_event_bus.pricing_service_bus.arn
#   domain_bus_name = aws_cloudwatch_event_bus.pricing_service_bus.name
#   queue_arn       = aws_sqs_queue.product_created_queue.arn
#   queue_name      = aws_sqs_queue.product_created_queue.name
#   queue_id        = aws_sqs_queue.product_created_queue.id
#   event_pattern   = <<EOF
# {
#   "detail-type": [
#     "product.productCreated.v1"
#   ],
#   "source": [
#     "${var.env}.products"
#   ]
# }
# EOF
# }

# module "handle_product_created_lambda" {
#   service_name   = "PricingService"
#   source         = "../../modules/lambda-function"
#   zip_file       = "../out/productCreatedPricingHandler/productCreatedPricingHandler.zip"
#   function_name  = "HandleProductCreated"
#   lambda_handler = "index.handler"
#   environment_variables = {
#     "EVENT_BUS_NAME" : var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.pricing_service_bus.name
#     "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "none"
#     "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "ignore"
#   }
#   dd_api_key_secret_arn = var.dd_api_key_secret_arn
#   dd_site               = var.dd_site
#   app_version           = var.app_version
#   env                   = var.env
#   additional_policy_attachments = [
#     aws_iam_policy.sqs_receive_policy.arn,
#     aws_iam_policy.eb_publish.arn
#   ]
# }

# resource "aws_lambda_event_source_mapping" "product_created_queue_esm" {
#   event_source_arn        = aws_sqs_queue.product_created_queue.arn
#   function_name           = module.handle_product_created_lambda.function_arn
#   function_response_types = ["ReportBatchItemFailures"]
# }

# resource "aws_sqs_queue" "product_updated_dlq" {
#   name = "PricingService-ProductUpdatedDLQ-${var.env}"
# }

# resource "aws_sqs_queue" "product_updated_queue" {
#   name                      = "PricingService-ProductUpdatedQueue-${var.env}"
#   receive_wait_time_seconds = 10
#   redrive_policy = jsonencode({
#     deadLetterTargetArn = aws_sqs_queue.product_updated_dlq.arn
#     maxReceiveCount     = 3
#   })
# }

# module "shared_bus_product_updated_subscription" {
#   count           = var.env == "dev" || var.env == "prod" ? 1 : 0
#   source          = "../../modules/shared_bus_to_domain"
#   rule_name       = "PricingService_ProductUpdated_Rule"
#   env             = var.env
#   shared_bus_name = var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[count.index].value : ""
#   domain_bus_arn  = aws_cloudwatch_event_bus.pricing_service_bus.arn
#   domain_bus_name = aws_cloudwatch_event_bus.pricing_service_bus.name
#   queue_arn       = aws_sqs_queue.product_updated_queue.arn
#   queue_name      = aws_sqs_queue.product_updated_queue.name
#   queue_id        = aws_sqs_queue.product_updated_queue.id
#   event_pattern   = <<EOF
# {
#   "detail-type": [
#     "product.productUpdated.v1"
#   ],
#   "source": [
#     "${var.env}.products"
#   ]
# }
# EOF
# }

# module "handle_product_updated_lambda" {
#   service_name   = "PricingService"
#   source         = "../../modules/lambda-function"
#   zip_file       = "../out/productUpdatedPricingHandler/productUpdatedPricingHandler.zip"
#   function_name  = "HandleProductUpdated"
#   lambda_handler = "index.handler"
#   environment_variables = {
#     "EVENT_BUS_NAME" : var.env == "dev" || var.env == "prod" ? data.aws_ssm_parameter.shared_eb_name[0].value : aws_cloudwatch_event_bus.pricing_service_bus.name
#     "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "none"
#     "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "ignore"
#   }
#   dd_api_key_secret_arn = var.dd_api_key_secret_arn
#   dd_site               = var.dd_site
#   app_version           = var.app_version
#   env                   = var.env
#   additional_policy_attachments = [
#     aws_iam_policy.sqs_receive_policy.arn,
#     aws_iam_policy.eb_publish.arn
#   ]
# }

# resource "aws_lambda_event_source_mapping" "stock_reservation_failed_queue" {
#   event_source_arn        = aws_sqs_queue.product_updated_queue.arn
#   function_name           = module.handle_product_updated_lambda.function_arn
#   function_response_types = ["ReportBatchItemFailures"]
# }
