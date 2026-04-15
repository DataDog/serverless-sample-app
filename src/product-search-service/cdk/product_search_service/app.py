#!/usr/bin/env python3
import os

from aws_cdk import App, Environment
from boto3 import client, session
from cdk.product_search_service.product_search_stack import ProductSearchStack

account = client('sts').get_caller_identity()['Account']
boto_region = session.Session().region_name
environment = os.getenv('ENV', 'dev')

# AWS_REGION takes precedence (set explicitly), falling back to AWS_DEFAULT_REGION
# (boto3 convention), then the region inferred from the active AWS profile.
region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or boto_region

app = App()

ProductSearchStack(
    scope=app,
    id=f"ProductSearchService-{environment}",
    env=Environment(
        account=account,
        region=region,
    ),
)

app.synth()
