data "aws_iam_policy_document" "allow_domain_bus_put_events" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  statement {
    actions   = ["events:PutEvents"]
    resources = [
      var.domain_bus_arn
    ]
  }
}

resource "aws_iam_policy" "shared_eb_publish" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  name   = "${var.rule_name}-publish-${var.env}"
  path   = "/"
  policy = data.aws_iam_policy_document.allow_domain_bus_put_events[count.index].json
}

resource "aws_iam_role" "shared_eb_publish_role" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  name   = "${var.rule_name}-publish-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "shared_eb_publish_role_attachment" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  role       = aws_iam_role.shared_eb_publish_role[count.index].id
  policy_arn = aws_iam_policy.shared_eb_publish[count.index].arn
}

// Only deploy rules to the shared bus if the shared bus name is provided
resource "aws_cloudwatch_event_rule" "shared_bus_rule" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  name           = var.rule_name
  event_bus_name = var.shared_bus_name
  event_pattern  = var.event_pattern
}
resource "aws_cloudwatch_event_target" "shared_bus_to_domain_bus_target" {
  count = length(var.shared_bus_name) > 0 ? 1 : 0
  rule           = aws_cloudwatch_event_rule.shared_bus_rule[count.index].name
  arn            = var.domain_bus_arn
  event_bus_name = var.shared_bus_name
  role_arn = aws_iam_role.shared_eb_publish_role[count.index].arn
}

// Deploy rule to domain bus
resource "aws_cloudwatch_event_rule" "domain_bus_rule" {
  name           = var.rule_name
  event_bus_name = var.domain_bus_name
  event_pattern  = var.event_pattern
}

// Configure a Lambda target if the function_name is provided
resource "aws_cloudwatch_event_target" "domain_bus_target" {
  count = length(var.function_name) > 0 ? 1 : 0
  rule           = aws_cloudwatch_event_rule.domain_bus_rule.name
  arn            = var.function_arn
  event_bus_name = var.domain_bus_name
}
resource "aws_lambda_permission" "allow_db_to_invoke_function" {
  count = length(var.function_name) > 0 ? 1 : 0
  action        = "lambda:InvokeFunction"
  function_name = var.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.domain_bus_rule.arn
}

// Configure a SQS target if the queue_name is provided
resource "aws_cloudwatch_event_target" "sqs_target" {
  count = length(var.queue_name) > 0 ? 1 : 0
  rule           = aws_cloudwatch_event_rule.domain_bus_rule.name
  target_id      = var.queue_name
  arn            = var.queue_arn
  event_bus_name = var.domain_bus_name
}
data "aws_iam_policy_document" "allow_eb_publish_policy" {
  count = length(var.queue_name) > 0 ? 1 : 0
  statement {
    sid    = "AllowEBPost"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [var.queue_arn]
  }
}
resource "aws_sqs_queue_policy" "sqs_target_permissions" {
  count = length(var.queue_name) > 0 ? 1 : 0
  queue_url = var.queue_id
  policy    = data.aws_iam_policy_document.allow_eb_publish_policy[count.index].json
}