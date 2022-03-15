# Unless explicitly stated otherwise all files in this repository are licensed
# under the Apache License Version 2.0.
# This product includes software developed at Datadog (https://www.datadoghq.com/).
# Copyright 2022 Datadog, Inc.

import boto3, os

# Entry Lambda Function Code
def handler(event, context):
    sns = boto3.client('sns')

    sns.publish(
        TopicArn=os.environ.get("SNS_TOPIC_ARN"),
        Message='Message sent to SNS'
        )

    return {
        "body": "Sent message to SNS",
        "statusCode": 200
    }